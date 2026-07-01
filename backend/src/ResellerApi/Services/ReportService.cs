using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Reports;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ReportService : IReportService
{
    private readonly AppDbContext _db;

    public ReportService(AppDbContext db)
    {
        _db = db;
    }

    // ── Dashboard ──────────────────────────────────────────────────────────────

    public async Task<DashboardKpiDto> GetDashboardAsync(bool canSeeCosts)
    {
        var todayUtc = DateTime.UtcNow.Date;
        var tomorrowUtc = todayUtc.AddDays(1);

        // Today's orders (non-cancelled)
        var todayOrders = await _db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= todayUtc && o.CreatedAt < tomorrowUtc && o.OrderStatus != "CANCELLED" && !o.IsDraft)
            .Include(o => o.Items.Where(i => i.DeletedAt == null))
            .Include(o => o.Payments)
            .ToListAsync();

        decimal todaySales = 0;
        decimal todayProfit = 0;
        decimal productsSold = 0;
        var customerSet = new HashSet<string>();

        foreach (var o in todayOrders)
        {
            var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
            var disc = ComputeDiscount(o, sub);
            var total = sub - disc + o.DeliveryChargeCustomer;
            todaySales += total;

            if (canSeeCosts)
            {
                var cogs = o.Items.Sum(i => i.UnitCostSnapshot.GetValueOrDefault() * i.Qty) + o.DeliveryCostActual;
                todayProfit += total - cogs;
            }

            productsSold += o.Items.Sum(i => i.Qty);
            if (!string.IsNullOrEmpty(o.CustomerPhone))
                customerSet.Add(o.CustomerPhone);
        }

        var todayReturns = await _db.Orders.AsNoTracking()
            .CountAsync(o => o.ReturnedAt >= todayUtc && o.ReturnedAt < tomorrowUtc);

        // Stock status
        var lowStockCount = await _db.VariantInventories.AsNoTracking()
            .Join(_db.ProductVariants.AsNoTracking(),
                vi => vi.VariantId, pv => pv.Id, (vi, pv) => new { vi.OnHand, pv.ProductId })
            .Join(_db.Products.AsNoTracking(),
                x => x.ProductId, p => p.Id, (x, p) => new { x.OnHand, p.LowStockThreshold })
            .CountAsync(x => x.OnHand > 0 && x.OnHand <= x.LowStockThreshold);

        var outOfStockCount = await _db.VariantInventories.AsNoTracking()
            .CountAsync(vi => vi.OnHand <= 0);

        // Sales trend — last 30 days from order payments
        var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
        var paymentsByDay = await _db.Set<ResellerApi.Entities.OrderPayment>().AsNoTracking()
            .Where(p => p.CreatedAt >= thirtyDaysAgo)
            .GroupBy(p => p.CreatedAt.Date)
            .Select(g => new { Day = g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync();

        var salesTrend = Enumerable.Range(0, 30).Select(i =>
        {
            var d = thirtyDaysAgo.AddDays(i);
            var val = paymentsByDay.FirstOrDefault(x => x.Day == d)?.Total ?? 0;
            return new DatePoint(d.ToString("MMM dd"), val);
        }).ToList();

        List<NameValue> topProducts = new();
        try
        {
            // Top 10 products by revenue (last 30 days)
            // NOTE: GroupBy+Sum after a double Join can't be translated by the SQL Server
            // provider (nested TransparentIdentifier), so materialize the flat rows first
            // and aggregate in memory.
            var topProductsRaw = await _db.Set<ResellerApi.Entities.OrderItem>().AsNoTracking()
                .Where(i => i.DeletedAt == null && i.CreatedAt >= thirtyDaysAgo)
                .Join(_db.ProductVariants.AsNoTracking(), i => i.VariantId, pv => pv.Id,
                    (i, pv) => new { i.Qty, i.UnitPrice, pv.ProductId })
                .Join(_db.Products.AsNoTracking(), x => x.ProductId, p => p.Id,
                    (x, p) => new { x.Qty, x.UnitPrice, ProductName = p.Name })
                .ToListAsync();

            topProducts = topProductsRaw
                .GroupBy(x => x.ProductName)
                .Select(g => new NameValue(g.Key, g.Sum(x => x.Qty * x.UnitPrice)))
                .OrderByDescending(x => x.Value)
                .Take(10)
                .ToList();
        }
        catch (Exception)
        {
        }



        // Payment method distribution (last 30 days)
        var paymentMethods = await _db.Set<ResellerApi.Entities.OrderPayment>().AsNoTracking()
            .Where(p => p.CreatedAt >= thirtyDaysAgo)
            .GroupBy(p => p.Method)
            .Select(g => new NameValue(g.Key, g.Sum(x => x.Amount)))
            .ToListAsync();

        // Hourly sales (today)
        var hourlyRaw = await _db.Set<ResellerApi.Entities.OrderPayment>().AsNoTracking()
            .Where(p => p.CreatedAt >= todayUtc && p.CreatedAt < tomorrowUtc)
            .GroupBy(p => p.CreatedAt.Hour)
            .Select(g => new { Hour = g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync();

        var hourlySales = Enumerable.Range(0, 24).Select(h =>
        {
            var val = hourlyRaw.FirstOrDefault(x => x.Hour == h)?.Total ?? 0;
            return new DatePoint($"{h:D2}:00", val);
        }).ToList();

        // Sales by category (last 30 days)
        var byCategoryRaw = await _db.Set<ResellerApi.Entities.OrderItem>().AsNoTracking()
            .Where(i => i.DeletedAt == null && i.CreatedAt >= thirtyDaysAgo)
            .Join(_db.ProductVariants.AsNoTracking(), i => i.VariantId, pv => pv.Id,
                (i, pv) => new { i.Qty, i.UnitPrice, pv.ProductId })
            .Join(_db.Products.AsNoTracking(), x => x.ProductId, p => p.Id,
                (x, p) => new { x.Qty, x.UnitPrice, p.CategoryId })
            .Join(_db.Categories.AsNoTracking(), x => x.CategoryId, c => c.Id,
                (x, c) => new { x.Qty, x.UnitPrice, CatName = c.Name })
            .ToListAsync();

        var byCategory = byCategoryRaw
            .GroupBy(x => x.CatName)
            .Select(g => new NameValue(g.Key, g.Sum(x => x.Qty * x.UnitPrice)))
            .OrderByDescending(x => x.Value)
            .ToList();

        return new DashboardKpiDto(
            todaySales,
            todayOrders.Count,
            canSeeCosts ? todayProfit : 0,
            customerSet.Count,
            productsSold,
            todayReturns,
            lowStockCount,
            outOfStockCount,
            salesTrend,
            topProducts,
            paymentMethods,
            hourlySales,
            byCategory
        );
    }

    // ── Sales Summary ──────────────────────────────────────────────────────────

    public async Task<SalesSummaryDto> GetSalesSummaryAsync(DateTime from, DateTime to, string groupBy)
    {
        var toExclusive = to.Date.AddDays(1);

        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= from.Date && o.CreatedAt < toExclusive && o.OrderStatus != "CANCELLED" && !o.IsDraft)
            .Include(o => o.Items.Where(i => i.DeletedAt == null))
            .Include(o => o.Payments)
            .ToListAsync();

        decimal totalRevenue = 0;
        decimal totalDiscount = 0;

        foreach (var o in orders)
        {
            var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
            var disc = ComputeDiscount(o, sub);
            totalRevenue += sub - disc + o.DeliveryChargeCustomer;
            totalDiscount += disc;
        }

        var aov = orders.Count > 0 ? totalRevenue / orders.Count : 0;

        // Revenue by period
        var revenueByPeriod = BuildDatePoints(orders.Select(o =>
        {
            var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
            var disc = ComputeDiscount(o, sub);
            return (o.CreatedAt.Date, sub - disc + o.DeliveryChargeCustomer);
        }), from.Date, to.Date, groupBy);

        // Top products
        var topProducts = orders.SelectMany(o => o.Items)
            .GroupBy(i => i.Variant?.Product?.Name ?? "Unknown")
            .Select(g => new NameValue(g.Key, g.Sum(i => i.Qty * i.UnitPrice)))
            .OrderByDescending(x => x.Value)
            .Take(10)
            .ToList();

        // By category — need category names; items don't have them loaded, so do a separate query
        var variantIds = orders.SelectMany(o => o.Items).Select(i => i.VariantId).Distinct().ToList();
        var categoryByVariant = await _db.ProductVariants.AsNoTracking()
            .Where(pv => variantIds.Contains(pv.Id))
            .Include(pv => pv.Product).ThenInclude(p => p.Category)
            .ToDictionaryAsync(pv => pv.Id, pv => pv.Product?.Category?.Name ?? "Other");

        var byCategory = orders.SelectMany(o => o.Items)
            .GroupBy(i => categoryByVariant.TryGetValue(i.VariantId, out var c) ? c : "Other")
            .Select(g => new NameValue(g.Key, g.Sum(i => i.Qty * i.UnitPrice)))
            .OrderByDescending(x => x.Value)
            .ToList();

        // By cashier — orders loaded without user nav; do separately
        var userIds = orders.Select(o => o.HandlingUserId ?? o.CreatedBy).Distinct().ToList();
        var userNames = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        var byCashier = orders
            .GroupBy(o => userNames.TryGetValue(o.HandlingUserId ?? o.CreatedBy, out var n) ? n : "Unknown")
            .Select(g =>
            {
                var rev = g.Sum(o =>
                {
                    var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
                    return sub - ComputeDiscount(o, sub) + o.DeliveryChargeCustomer;
                });
                return new NameValue(g.Key, rev);
            })
            .OrderByDescending(x => x.Value)
            .ToList();

        // By payment method
        var byPaymentMethod = await _db.Set<ResellerApi.Entities.OrderPayment>().AsNoTracking()
            .Where(p => p.CreatedAt >= from.Date && p.CreatedAt < toExclusive)
            .GroupBy(p => p.Method)
            .Select(g => new NameValue(g.Key, g.Sum(x => x.Amount)))
            .ToListAsync();

        // Hourly sales
        var hourlyRaw = await _db.Set<ResellerApi.Entities.OrderPayment>().AsNoTracking()
            .Where(p => p.CreatedAt >= from.Date && p.CreatedAt < toExclusive)
            .GroupBy(p => p.CreatedAt.Hour)
            .Select(g => new { Hour = g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync();

        var hourlySales = Enumerable.Range(0, 24).Select(h =>
            new DatePoint($"{h:D2}:00", hourlyRaw.FirstOrDefault(x => x.Hour == h)?.Total ?? 0)
        ).ToList();

        return new SalesSummaryDto(
            totalRevenue, orders.Count, totalDiscount, Math.Round(aov, 2),
            revenueByPeriod, topProducts, byCategory, byCashier, byPaymentMethod, hourlySales
        );
    }

    // ── Inventory ──────────────────────────────────────────────────────────────

    public async Task<InventoryReportDto> GetInventoryReportAsync(DateTime from, DateTime to, string groupBy, bool canSeeCosts)
    {
        var items = await _db.VariantInventories.AsNoTracking()
            .Join(_db.ProductVariants.AsNoTracking().Where(pv => pv.DeletedAt == null),
                vi => vi.VariantId, pv => pv.Id, (vi, pv) => new { vi, pv })
            .Join(_db.Products.AsNoTracking().Where(p => p.DeletedAt == null && p.Status == "ACTIVE"),
                x => x.pv.ProductId, p => p.Id, (x, p) => new { x.vi, x.pv, p })
            .ToListAsync();

        var stockItems = items.Select(x =>
        {
            var available = x.vi.OnHand - x.vi.Committed;
            var isLow = x.vi.OnHand > 0 && x.vi.OnHand <= x.p.LowStockThreshold;
            var isOut = x.vi.OnHand <= 0;
            return new StockStatusItem(
                x.pv.Sku, x.p.Name,
                x.pv.VariantValuesJson == "{}" ? null : x.pv.VariantValuesJson,
                x.vi.OnHand, x.vi.Committed, available, x.vi.Damaged,
                x.p.LowStockThreshold, isLow, isOut
            );
        }).OrderBy(x => x.ProductName).ToList();

        decimal inventoryValue = canSeeCosts
            ? items.Sum(x => x.vi.OnHand * x.pv.AvgLandedCost)
            : 0;

        // Movement trend — net movements over selected range (PURCHASE_IN positive, SALE_OUT negative)
        var toExclusive = to.Date.AddDays(1);
        var movements = await _db.StockMovements.AsNoTracking()
            .Where(m => m.CreatedAt >= from.Date && m.CreatedAt < toExclusive && (m.MovementType == "PURCHASE_IN" || m.MovementType == "SALE_OUT"))
            .ToListAsync();

        var movementTrend = BuildDatePoints(
            movements.Select(m => (m.CreatedAt.Date, m.Qty)),
            from.Date, to.Date, groupBy);

        // Fast/slow moving — over selected range
        // NOTE: GroupBy+Sum after a double Join can't be translated by the SQL Server
        // provider (nested TransparentIdentifier), so materialize the flat rows first
        // and aggregate in memory.
        List<NameValue> fastMoving = new();
        List<NameValue> slowMoving = new();
        try
        {
            var movementRaw = await _db.Set<ResellerApi.Entities.OrderItem>().AsNoTracking()
                .Where(i => i.DeletedAt == null && i.CreatedAt >= from.Date && i.CreatedAt < toExclusive)
                .Join(_db.ProductVariants.AsNoTracking(), i => i.VariantId, pv => pv.Id,
                    (i, pv) => new { i.Qty, pv.ProductId })
                .Join(_db.Products.AsNoTracking(), x => x.ProductId, p => p.Id,
                    (x, p) => new { x.Qty, ProductName = p.Name })
                .ToListAsync();

            var byProduct = movementRaw
                .GroupBy(x => x.ProductName)
                .Select(g => new NameValue(g.Key, g.Sum(x => x.Qty)))
                .ToList();

            fastMoving = byProduct.OrderByDescending(x => x.Value).Take(10).ToList();
            slowMoving = byProduct.OrderBy(x => x.Value).Take(10).ToList();
        }
        catch (Exception)
        {
        }

        return new InventoryReportDto(
            stockItems.Count,
            stockItems.Count(x => x.IsLowStock),
            stockItems.Count(x => x.IsOutOfStock),
            inventoryValue,
            stockItems,
            movementTrend,
            fastMoving,
            slowMoving
        );
    }

    // ── Financial P&L ──────────────────────────────────────────────────────────

    public async Task<PnlReportDto> GetPnlReportAsync(DateTime from, DateTime to, string groupBy, bool canSeeCosts)
    {
        var toExclusive = to.Date.AddDays(1);

        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= from.Date && o.CreatedAt < toExclusive && o.OrderStatus != "CANCELLED" && !o.IsDraft)
            .Include(o => o.Items.Where(i => i.DeletedAt == null))
            .ToListAsync();

        decimal revenue = 0, cogs = 0, discounts = 0;
        foreach (var o in orders)
        {
            var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
            var disc = ComputeDiscount(o, sub);
            discounts += disc;
            var total = sub - disc + o.DeliveryChargeCustomer;
            revenue += total;
            cogs += o.Items.Sum(i => i.UnitCostSnapshot.GetValueOrDefault() * i.Qty) + o.DeliveryCostActual;
        }

        var grossProfit = revenue - cogs;
        var grossMarginPct = revenue > 0 ? Math.Round(grossProfit / revenue * 100, 1) : 0;

        var fromDt = from.Date;
        var toDt = to.Date.AddDays(1); // exclusive upper bound

        var totalExpenses = await _db.Expenses.AsNoTracking()
            .Where(e => e.ExpenseDate >= fromDt && e.ExpenseDate < toDt && e.Status == "APPROVED")
            .SumAsync(e => e.Amount);

        var netProfit = grossProfit - totalExpenses;
        var netMarginPct = revenue > 0 ? Math.Round(netProfit / revenue * 100, 1) : 0;

        // Revenue trend by period
        var revenueTrend = BuildDatePoints(orders.Select(o =>
        {
            var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
            return (o.CreatedAt.Date, sub - ComputeDiscount(o, sub) + o.DeliveryChargeCustomer);
        }), from.Date, to.Date, groupBy);

        // Profit trend
        var profitTrend = BuildDatePoints(orders.Select(o =>
        {
            var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
            var disc = ComputeDiscount(o, sub);
            var total = sub - disc + o.DeliveryChargeCustomer;
            var orderCogs = o.Items.Sum(i => i.UnitCostSnapshot.GetValueOrDefault() * i.Qty) + o.DeliveryCostActual;
            return (o.CreatedAt.Date, total - orderCogs);
        }), from.Date, to.Date, groupBy);

        // Expense trend — load once, reuse for trend + by-category
        var expensesByDay = await _db.Expenses.AsNoTracking()
            .Where(e => e.ExpenseDate >= fromDt && e.ExpenseDate < toDt && e.Status == "APPROVED")
            .Include(e => e.Category)
            .ToListAsync();

        var expenseTrend = BuildDatePoints(
            expensesByDay.Select(e => (e.ExpenseDate.Date, e.Amount)),
            from.Date, to.Date, groupBy);

        // Expenses by category
        var expenseByCategory = expensesByDay
            .GroupBy(e => e.Category?.Name ?? "Other")
            .Select(g => new NameValue(g.Key, g.Sum(e => e.Amount)))
            .OrderByDescending(x => x.Value)
            .ToList();

        return new PnlReportDto(
            revenue, cogs, grossProfit, grossMarginPct,
            totalExpenses, netProfit, netMarginPct, discounts,
            revenueTrend, profitTrend, expenseTrend, expenseByCategory
        );
    }

    // ── Orders Report ──────────────────────────────────────────────────────────

    public async Task<OrdersReportDto> GetOrdersReportAsync(DateTime from, DateTime to, string groupBy)
    {
        var toExclusive = to.Date.AddDays(1);

        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= from.Date && o.CreatedAt < toExclusive && !o.IsDraft)
            .ToListAsync();

        var total = orders.Count;
        var completed = orders.Count(o => o.OrderStatus == "COMPLETED");
        var pending = orders.Count(o => o.OrderStatus == "OPEN");
        var cancelled = orders.Count(o => o.OrderStatus == "CANCELLED");
        var returned = orders.Count(o => o.FulfillmentStatus == "RETURNED");
        var returnRate = total > 0 ? Math.Round((decimal)returned / total * 100, 1) : 0;

        var ordersTrend = BuildDatePoints(
            orders.Where(o => o.OrderStatus != "CANCELLED").Select(o => (o.CreatedAt.Date, 1m)),
            from.Date, to.Date, groupBy);

        var cancelledTrend = BuildDatePoints(
            orders.Where(o => o.OrderStatus == "CANCELLED").Select(o => (o.CreatedAt.Date, 1m)),
            from.Date, to.Date, groupBy);

        var returnReasons = orders
            .Where(o => o.FulfillmentStatus == "RETURNED" && o.ReturnReason != null)
            .GroupBy(o => o.ReturnReason!)
            .Select(g => new NameValue(g.Key, g.Count()))
            .ToList();

        var byChannel = orders
            .GroupBy(o => o.Channel)
            .Select(g => new NameValue(g.Key, g.Count()))
            .OrderByDescending(x => x.Value)
            .ToList();

        return new OrdersReportDto(
            total, completed, pending, cancelled, returned, returnRate,
            ordersTrend, cancelledTrend, returnReasons, byChannel
        );
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static decimal ComputeDiscount(ResellerApi.Entities.Order o, decimal sub)
    {
        if (o.DiscountType == null || o.DiscountValue == null) return 0;
        return o.DiscountType == "PERCENT"
            ? Math.Round(sub * o.DiscountValue.Value / 100, 2)
            : o.DiscountValue.Value;
    }

    private static List<DatePoint> BuildDatePoints(
        IEnumerable<(DateTime date, decimal value)> data,
        DateTime from, DateTime to, string groupBy)
    {
        var totalDays = (int)(to - from).TotalDays + 1;

        if (groupBy == "month")
        {
            var grouped = data.GroupBy(x => new { x.date.Year, x.date.Month })
                .ToDictionary(g => (g.Key.Year, g.Key.Month), g => g.Sum(x => x.value));
            var result = new List<DatePoint>();
            var cur = new DateTime(from.Year, from.Month, 1);
            while (cur <= to)
            {
                var key = (cur.Year, cur.Month);
                result.Add(new DatePoint(cur.ToString("MMM yyyy"), grouped.TryGetValue(key, out var v) ? v : 0));
                cur = cur.AddMonths(1);
            }
            return result;
        }
        else if (groupBy == "week")
        {
            var grouped = data
                .GroupBy(x =>
                {
                    var diff = (x.date - from).Days;
                    return diff / 7;
                })
                .ToDictionary(g => g.Key, g => g.Sum(x => x.value));
            var weeks = (totalDays + 6) / 7;
            return Enumerable.Range(0, weeks).Select(i =>
            {
                var weekStart = from.AddDays(i * 7);
                return new DatePoint($"W{i + 1} ({weekStart:MMM dd})", grouped.TryGetValue(i, out var v) ? v : 0);
            }).ToList();
        }
        else // day
        {
            var grouped = data.GroupBy(x => x.date)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.value));
            return Enumerable.Range(0, totalDays).Select(i =>
            {
                var d = from.AddDays(i);
                return new DatePoint(d.ToString("MMM dd"), grouped.TryGetValue(d, out var v) ? v : 0);
            }).ToList();
        }
    }
}
