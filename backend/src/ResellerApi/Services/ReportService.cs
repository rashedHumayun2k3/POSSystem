using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Reports;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
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
            .Where(OrderFinancials.SoldOrderFilter(todayUtc, tomorrowUtc))
            .Include(o => o.Items.Where(i => i.DeletedAt == null))
            .Include(o => o.Payments)
            .ToListAsync();

        decimal todaySales = 0;
        decimal todayProfit = 0;
        decimal productsSold = 0;
        var customerSet = new HashSet<string>();

        foreach (var o in todayOrders)
        {
            var total = OrderFinancials.ComputeOrderRevenue(o);
            todaySales += total;

            if (canSeeCosts)
                todayProfit += total - OrderFinancials.ComputeOrderCogs(o);

            productsSold += o.Items.Sum(i => i.Qty);
            if (!string.IsNullOrEmpty(o.CustomerPhone))
                customerSet.Add(o.CustomerPhone);
        }

        var todayReturns = await _db.Orders.AsNoTracking()
            .CountAsync(o => o.ReturnedAt >= todayUtc && o.ReturnedAt < tomorrowUtc);

        var (lowStockCount, outOfStockCount) = await GetStockAlertCountsAsync();

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
            // OrderItem has no BranchId of its own — join through Orders (already
            // branch-filtered by the global query filter) to keep this branch-scoped too.
            var topProductsRaw = await _db.Set<ResellerApi.Entities.OrderItem>().AsNoTracking()
                .Where(i => i.DeletedAt == null && i.CreatedAt >= thirtyDaysAgo)
                .Join(_db.Orders.AsNoTracking(), i => i.OrderId, o => o.Id, (i, o) => i)
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
        // OrderItem has no BranchId of its own — join through Orders (already
        // branch-filtered by the global query filter) to keep this branch-scoped too.
        var byCategoryRaw = await _db.Set<ResellerApi.Entities.OrderItem>().AsNoTracking()
            .Where(i => i.DeletedAt == null && i.CreatedAt >= thirtyDaysAgo)
            .Join(_db.Orders.AsNoTracking(), i => i.OrderId, o => o.Id, (i, o) => i)
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

    // BranchVariantInventories isn't globally branch-filtered (its BranchId is part of the
    // composite key), so sum across branches when CurrentBranchId is null (OWNER/MANAGER
    // "All Branches" view) or filter to one branch otherwise.
    private async Task<(int LowStockCount, int OutOfStockCount)> GetStockAlertCountsAsync()
    {
        var stockByVariant = await _db.BranchVariantInventories.AsNoTracking()
            .Where(vi => _db.CurrentBranchId == null || vi.BranchId == _db.CurrentBranchId)
            .GroupBy(vi => vi.VariantId)
            .Select(g => new { VariantId = g.Key, OnHand = g.Sum(x => x.OnHand) })
            .Join(_db.ProductVariants.AsNoTracking(), x => x.VariantId, pv => pv.Id,
                (x, pv) => new { x.OnHand, pv.ProductId })
            .Join(_db.Products.AsNoTracking(), x => x.ProductId, p => p.Id,
                (x, p) => new { x.OnHand, p.LowStockThreshold })
            .ToListAsync();

        var lowStockCount = stockByVariant.Count(x => x.OnHand > 0 && x.OnHand <= x.LowStockThreshold);
        var outOfStockCount = stockByVariant.Count(x => x.OnHand <= 0);
        return (lowStockCount, outOfStockCount);
    }

    // ── Home summary (mobile home page tiles) ────────────────────────────────────

    public async Task<HomeSummaryDto> GetHomeSummaryAsync()
    {
        var todayUtc = DateTime.UtcNow.Date;
        var tomorrowUtc = todayUtc.AddDays(1);

        var todayOrders = await _db.Orders.AsNoTracking()
            .CountAsync(OrderFinancials.SoldOrderFilter(todayUtc, tomorrowUtc));

        // "Pending deliveries" = handed to courier, not yet delivered to the customer — not
        // "confirmed but still sitting in the warehouse" (that's Waiting for Courier territory).
        // No separate !IsDraft/OrderStatus!=CANCELLED guard needed: a draft can never reach
        // IN_TRANSIT (must be confirmed first), and Cancel is blocked once IN_TRANSIT (see
        // OrderService.CancelAsync), so every IN_TRANSIT order already satisfies both anyway.
        var pendingDeliveries = await _db.Orders.AsNoTracking()
            .CountAsync(o => o.FulfillmentStatus == "IN_TRANSIT");

        var (lowStockCount, outOfStockCount) = await GetStockAlertCountsAsync();

        // Money currently held by couriers as collected COD, awaiting remittance to us — same
        // definition as RemittanceService.GetSummaryAsync's per-courier receivable.
        var atCourierOrders = await _db.Orders.AsNoTracking()
            .Include(o => o.Items.Where(i => i.DeletedAt == null))
            .Include(o => o.Payments)
            .Where(o => o.CourierId != null && o.CodRemittanceStatus == "PENDING")
            .ToListAsync();
        var moneyAtCourier = atCourierOrders.Sum(o =>
            Math.Max(0, OrderFinancials.ComputeOrderRevenue(o) - o.Payments.Sum(p => p.Amount)));

        // Customer baki — unpaid/partially-paid orders, excluding COD cash already tracked
        // above as courier money (that's the courier's cash to remit, not the customer's debt).
        var receivableOrders = await _db.Orders.AsNoTracking()
            .Include(o => o.Items.Where(i => i.DeletedAt == null))
            .Include(o => o.Payments)
            .Where(o => o.OrderStatus != "CANCELLED" && !o.IsDraft
                && (o.PaymentStatus == "UNPAID" || o.PaymentStatus == "PARTIALLY_PAID")
                && o.CodRemittanceStatus != "PENDING")
            .ToListAsync();
        var customerReceivable = receivableOrders.Sum(o =>
            Math.Max(0, OrderFinancials.ComputeOrderRevenue(o) - o.Payments.Sum(p => p.Amount)));

        // Cash actually taken in today — doesn't net out cash spent from the drawer (petty cash
        // expenses), since there's no shift/drawer concept yet to track an opening float against.
        var todayCash = await _db.OrderPayments.AsNoTracking()
            .Where(p => p.Method == "CASH" && p.CreatedAt >= todayUtc && p.CreatedAt < tomorrowUtc)
            .Join(_db.Orders.AsNoTracking().Where(o => o.OrderStatus != "CANCELLED" && !o.IsDraft),
                p => p.OrderId, o => o.Id, (p, o) => p)
            .SumAsync(p => p.Amount);

        return new HomeSummaryDto(
            todayOrders,
            pendingDeliveries,
            lowStockCount + outOfStockCount,
            customerReceivable,
            moneyAtCourier,
            todayCash
        );
    }

    // ── Sales Summary ──────────────────────────────────────────────────────────

    public async Task<SalesSummaryDto> GetSalesSummaryAsync(DateTime from, DateTime to, string groupBy)
    {
        var toExclusive = to.Date.AddDays(1);

        var orders = await _db.Orders.AsNoTracking()
            .Where(OrderFinancials.SoldOrderFilter(from.Date, toExclusive))
            .Include(o => o.Items.Where(i => i.DeletedAt == null))
            .Include(o => o.Payments)
            .ToListAsync();

        decimal totalRevenue = 0;
        decimal totalDiscount = 0;

        foreach (var o in orders)
        {
            var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
            var disc = OrderFinancials.ComputeDiscount(o, sub);
            totalRevenue += sub - disc + o.DeliveryChargeCustomer;
            totalDiscount += disc;
        }

        var aov = orders.Count > 0 ? totalRevenue / orders.Count : 0;

        // Revenue by period
        var revenueByPeriod = BuildDatePoints(
            orders.Select(o => (o.CreatedAt.Date, OrderFinancials.ComputeOrderRevenue(o))),
            from.Date, to.Date, groupBy);

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
            .Select(g => new NameValue(g.Key, g.Sum(OrderFinancials.ComputeOrderRevenue)))
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
        // BranchVariantInventories isn't globally branch-filtered (its BranchId is part of the
        // composite key), so sum across branches when CurrentBranchId is null (OWNER/MANAGER
        // "All Branches" view) or filter to one branch otherwise.
        var stockByVariant = await _db.BranchVariantInventories.AsNoTracking()
            .Where(vi => _db.CurrentBranchId == null || vi.BranchId == _db.CurrentBranchId)
            .GroupBy(vi => vi.VariantId)
            .Select(g => new { VariantId = g.Key, OnHand = g.Sum(x => x.OnHand), Committed = g.Sum(x => x.Committed), Damaged = g.Sum(x => x.Damaged) })
            .ToListAsync();

        var variantIds = stockByVariant.Select(x => x.VariantId).ToList();
        var variants = await _db.ProductVariants.AsNoTracking()
            .Where(pv => pv.DeletedAt == null && variantIds.Contains(pv.Id))
            .ToListAsync();
        var productIds = variants.Select(v => v.ProductId).Distinct().ToList();
        var products = await _db.Products.AsNoTracking()
            .Where(p => p.DeletedAt == null && p.Status == "ACTIVE" && productIds.Contains(p.Id))
            .ToListAsync();

        var items = stockByVariant
            .Join(variants, x => x.VariantId, pv => pv.Id, (x, pv) => new { x.OnHand, x.Committed, x.Damaged, pv })
            .Join(products, x => x.pv.ProductId, p => p.Id, (x, p) => new { x.OnHand, x.Committed, x.Damaged, x.pv, p })
            .ToList();

        var stockItems = items.Select(x =>
        {
            var available = x.OnHand - x.Committed;
            var isLow = x.OnHand > 0 && x.OnHand <= x.p.LowStockThreshold;
            var isOut = x.OnHand <= 0;
            return new StockStatusItem(
                x.pv.Sku, x.p.Name,
                x.pv.VariantValuesJson == "{}" ? null : x.pv.VariantValuesJson,
                x.OnHand, x.Committed, available, x.Damaged,
                x.p.LowStockThreshold, isLow, isOut
            );
        }).OrderBy(x => x.ProductName).ToList();

        decimal inventoryValue = canSeeCosts
            ? items.Sum(x => x.OnHand * x.pv.AvgLandedCost)
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
            // OrderItem has no BranchId of its own — join through Orders (already
            // branch-filtered by the global query filter) to keep this branch-scoped too.
            var movementRaw = await _db.Set<ResellerApi.Entities.OrderItem>().AsNoTracking()
                .Where(i => i.DeletedAt == null && i.CreatedAt >= from.Date && i.CreatedAt < toExclusive)
                .Join(_db.Orders.AsNoTracking(), i => i.OrderId, o => o.Id, (i, o) => i)
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
            .Where(OrderFinancials.SoldOrderFilter(from.Date, toExclusive))
            .Include(o => o.Items.Where(i => i.DeletedAt == null))
            .ToListAsync();

        decimal revenue = 0, cogs = 0, discounts = 0;
        foreach (var o in orders)
        {
            var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
            discounts += OrderFinancials.ComputeDiscount(o, sub);
            revenue += OrderFinancials.ComputeOrderRevenue(o);
            cogs += OrderFinancials.ComputeOrderCogs(o);
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
        var revenueTrend = BuildDatePoints(
            orders.Select(o => (o.CreatedAt.Date, OrderFinancials.ComputeOrderRevenue(o))),
            from.Date, to.Date, groupBy);

        // Profit trend
        var profitTrend = BuildDatePoints(
            orders.Select(o => (o.CreatedAt.Date, OrderFinancials.ComputeOrderRevenue(o) - OrderFinancials.ComputeOrderCogs(o))),
            from.Date, to.Date, groupBy);

        // Expense trend — load once, reuse for trend + by-category
        var expensesByDay = await _db.Expenses.AsNoTracking()
            .Where(e => e.ExpenseDate >= fromDt && e.ExpenseDate < toDt && e.Status == "APPROVED")
            .Include(e => e.Category)
            .ToListAsync();

        var expenseTrend = BuildDatePoints(
            expensesByDay.Select(e => (e.ExpenseDate.Date, e.Amount)),
            from.Date, to.Date, groupBy);

        // Expenses by category, with a subtype-level breakdown nested under each — always includes
        // every active category for the business, even ones with zero spend this period, so the
        // UI shows a complete list (৳0) instead of silently omitting categories nobody's logged
        // against yet in the selected date range.
        var allCategories = await _db.ExpenseCategories.AsNoTracking()
            .Where(c => c.IsActive)
            .ToListAsync();

        var spendByCategoryId = expensesByDay
            .GroupBy(e => e.CategoryId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var expenseByCategory = allCategories
            .Select(c =>
            {
                var items = spendByCategoryId.GetValueOrDefault(c.Id, new List<Expense>());
                return new ExpenseCategoryBreakdownDto(
                    c.Code,
                    c.Name,
                    items.Sum(e => e.Amount),
                    items.GroupBy(e => e.SubType)
                        .Select(sg => new NameValue(sg.Key, sg.Sum(e => e.Amount)))
                        .OrderByDescending(x => x.Value)
                        .ToList()
                );
            })
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

    // ── Stock Valuation ──────────────────────────────────────────────────────────

    // Stock-side columns (buy price, on-hand, stock value, potential profit, total bought) are
    // always "as of now" and ignore fromUtc/toExclusiveUtc entirely — only the sales-side columns
    // are date-filtered. See StockValuationDtos.cs for the full time-semantics contract.
    public async Task<StockValuationResponseDto> GetStockValuationReportAsync(
        DateTime fromUtc, DateTime toExclusiveUtc, DateTime rangeFromDate, DateTime rangeToDate, string rangeLabel,
        Guid? categoryId)
    {
        var rangeDays = (toExclusiveUtc - fromUtc).TotalDays;
        var showVelocity = ShowVelocity(rangeDays);
        var monthsInRange = MonthsInRange(rangeDays);

        var productsQuery = _db.Products.AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants.Where(v => v.DeletedAt == null))
            .Where(p => p.Status == "ACTIVE");
        if (categoryId.HasValue)
            productsQuery = productsQuery.Where(p => p.CategoryId == categoryId.Value);
        var products = await productsQuery.ToListAsync();

        var variantIds = products.SelectMany(p => p.Variants).Select(v => v.Id).ToList();

        // On-hand — sums across branches when CurrentBranchId is null (OWNER/MANAGER "All
        // Branches" view), same convention as LoadInventoryAsync elsewhere.
        var onHandByVariant = await _db.BranchVariantInventories.AsNoTracking()
            .Where(vi => variantIds.Contains(vi.VariantId) && (_db.CurrentBranchId == null || vi.BranchId == _db.CurrentBranchId))
            .GroupBy(vi => vi.VariantId)
            .Select(g => new { VariantId = g.Key, OnHand = g.Sum(x => x.OnHand) })
            .ToDictionaryAsync(x => x.VariantId, x => x.OnHand);

        // Lifetime bought qty — not date-ranged, just context for the expanded card.
        var boughtByVariant = await _db.StockMovements.AsNoTracking()
            .Where(m => variantIds.Contains(m.VariantId) && m.MovementType == "PURCHASE_IN")
            .GroupBy(m => m.VariantId)
            .Select(g => new { VariantId = g.Key, Qty = g.Sum(x => x.Qty) })
            .ToDictionaryAsync(x => x.VariantId, x => x.Qty);

        // Sold, in range — same "sold order" definition as Dashboard/Sales/P&L (OrderFinancials).
        // NOTE: GroupBy+Sum after a double Join can't be translated by the SQL Server provider
        // (nested TransparentIdentifier), so materialize the flat rows first and aggregate in
        // memory — same workaround already used elsewhere in this file.
        var productIds = products.Select(p => p.Id).ToList();
        var soldRaw = await _db.Set<OrderItem>().AsNoTracking()
            .Where(i => i.DeletedAt == null)
            .Join(_db.Orders.AsNoTracking().Where(OrderFinancials.SoldOrderFilter(fromUtc, toExclusiveUtc)),
                i => i.OrderId, o => o.Id, (i, o) => i)
            .Join(_db.ProductVariants.AsNoTracking(), i => i.VariantId, pv => pv.Id,
                (i, pv) => new { i.Qty, i.UnitPrice, i.UnitCostSnapshot, pv.ProductId })
            .Where(x => productIds.Contains(x.ProductId))
            .ToListAsync();

        var soldByProduct = soldRaw
            .GroupBy(x => x.ProductId)
            .ToDictionary(g => g.Key, g => (
                QtySold: g.Sum(x => x.Qty),
                Revenue: g.Sum(x => x.Qty * x.UnitPrice),
                RealizedProfit: g.Sum(x => x.Qty * (x.UnitPrice - x.UnitCostSnapshot.GetValueOrDefault()))
            ));

        var productDtos = new List<StockValuationProductDto>();
        foreach (var p in products)
        {
            var variants = p.Variants.Where(v => v.DeletedAt == null).ToList();
            decimal onHandQty = 0, weightedCostSum = 0, totalBought = 0;
            foreach (var v in variants)
            {
                var onHand = onHandByVariant.TryGetValue(v.Id, out var oh) ? oh : 0;
                onHandQty += onHand;
                weightedCostSum += onHand * v.AvgLandedCost;
                totalBought += boughtByVariant.TryGetValue(v.Id, out var b) ? b : 0;
            }
            var avgBuyPrice = WeightedAvgBuyPrice(onHandQty, weightedCostSum);
            var stockValue = Math.Round(weightedCostSum, 2);
            var potentialProfit = Math.Round((p.SellingPrice - avgBuyPrice) * onHandQty, 2);

            var sold = soldByProduct.TryGetValue(p.Id, out var s) ? s : (QtySold: 0m, Revenue: 0m, RealizedProfit: 0m);
            var avgActualSellPrice = sold.QtySold > 0 ? Math.Round(sold.Revenue / sold.QtySold, 2) : 0;
            var soldPerMonth = SoldPerMonth(showVelocity, sold.QtySold, monthsInRange);
            var monthsLeft = MonthsOfStockLeft(showVelocity, onHandQty, soldPerMonth);

            productDtos.Add(new StockValuationProductDto(
                p.Id, p.Name, p.CategoryId, p.Category.Name,
                avgBuyPrice, onHandQty, stockValue, potentialProfit,
                sold.QtySold, sold.Revenue, sold.RealizedProfit, avgActualSellPrice,
                soldPerMonth, monthsLeft, totalBought
            ));
        }

        var categories = productDtos
            .GroupBy(x => (x.CategoryId, x.CategoryName))
            .Select(g => new StockValuationCategoryDto(
                g.Key.CategoryId, g.Key.CategoryName,
                Math.Round(g.Sum(x => x.StockValue), 2),
                Math.Round(g.Sum(x => x.RealizedProfit), 2),
                g.OrderByDescending(x => x.StockValue).ToList()
            ))
            .OrderByDescending(c => c.StockValue)
            .ToList();

        var grandStockValue = categories.Sum(c => c.StockValue);
        var grandPotentialProfit = productDtos.Sum(x => x.PotentialProfit);

        decimal grandRevenue, grandRealizedProfit;
        if (categoryId.HasValue)
        {
            // Category-filtered view — summed from the filtered per-product rows (same caveat as
            // existing by-category breakdowns: not apportioned for discount/delivery). The
            // Dashboard has no category filter to compare against anyway in this case.
            grandRevenue = productDtos.Sum(x => x.Revenue);
            grandRealizedProfit = productDtos.Sum(x => x.RealizedProfit);
        }
        else
        {
            // Whole-business view — computed properly at order level so this ties out exactly to
            // the Dashboard/P&L for the same period, per the explicit requirement to match them.
            var soldOrders = await _db.Orders.AsNoTracking()
                .Where(OrderFinancials.SoldOrderFilter(fromUtc, toExclusiveUtc))
                .Include(o => o.Items.Where(i => i.DeletedAt == null))
                .ToListAsync();
            grandRevenue = soldOrders.Sum(OrderFinancials.ComputeOrderRevenue);
            grandRealizedProfit = soldOrders.Sum(o => OrderFinancials.ComputeOrderRevenue(o) - OrderFinancials.ComputeOrderCogs(o));
        }

        return new StockValuationResponseDto(
            grandStockValue, grandPotentialProfit, grandRealizedProfit, grandRevenue,
            rangeFromDate, rangeToDate, rangeLabel, showVelocity,
            categories
        );
    }

    // Below ~28 days, velocity/months-left would be noise (e.g. a 3-day range extrapolated to a
    // month is meaningless), so both are hidden entirely rather than shown misleadingly.
    public static bool ShowVelocity(double rangeDays) => rangeDays >= 28;

    public static decimal MonthsInRange(double rangeDays) => (decimal)rangeDays / 30.44m;

    public static decimal WeightedAvgBuyPrice(decimal onHandQty, decimal weightedCostSum) =>
        onHandQty > 0 ? Math.Round(weightedCostSum / onHandQty, 2) : 0;

    public static decimal? SoldPerMonth(bool showVelocity, decimal qtySold, decimal monthsInRange) =>
        showVelocity && monthsInRange > 0 ? Math.Round(qtySold / monthsInRange, 2) : null;

    public static decimal? MonthsOfStockLeft(bool showVelocity, decimal onHandQty, decimal? soldPerMonth) =>
        showVelocity && soldPerMonth is > 0 ? Math.Round(onHandQty / soldPerMonth.Value, 1) : null;

    // ── Helpers ────────────────────────────────────────────────────────────────

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
