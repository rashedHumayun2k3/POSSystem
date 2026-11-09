using Microsoft.EntityFrameworkCore;
using ResellerApi.DTOs.Reports;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Services;

public partial class ReportService
{
    public async Task<DashboardSalesOverview> GetDashboardSalesOverviewAsync(bool canSeeCosts)
    {
        var today = DashboardToday; var first = today.AddDays(-6);
        var orders = await _db.Orders.AsNoTracking()
            .Where(OrderFinancials.SoldOrderFilter(DhakaTime.LocalToUtc(first), DhakaTime.LocalToUtc(today.AddDays(1))))
            .Include(o => o.Items.Where(i => i.DeletedAt == null)).ToListAsync();
        var daily = orders.GroupBy(o => DhakaTime.UtcToLocal(o.CreatedAt).Date)
            .ToDictionary(g => g.Key, g => g.Sum(OrderFinancials.ComputeOrderRevenue));
        var days = Enumerable.Range(0, 7).Select(i => new DatePoint(first.AddDays(i).ToString("yyyy-MM-dd"), daily.GetValueOrDefault(first.AddDays(i)))).ToList();
        var current = orders.Where(o => DhakaTime.UtcToLocal(o.CreatedAt).Date == today).ToList();
        var sales = days[^1].Value; var yesterday = days[^2].Value;
        decimal? change = yesterday > 0 ? Math.Round((sales - yesterday) / yesterday * 100, 1) : sales == 0 ? 0 : null;
        return new(sales, canSeeCosts ? current.Sum(o => OrderFinancials.ComputeOrderRevenue(o) - OrderFinancials.ComputeOrderCogs(o)) : null,
            current.Count, yesterday, change, days.Sum(d => d.Value), days);
    }

    public async Task<DashboardFinancialSummary> GetDashboardFinancialSummaryAsync(bool canSeeCosts)
    {
        var orders = await DashboardTodayOrders().Include(o => o.Items.Where(i => i.DeletedAt == null)).ToListAsync();
        var sales = orders.Sum(OrderFinancials.ComputeOrderRevenue);
        return new(sales, canSeeCosts ? sales - orders.Sum(OrderFinancials.ComputeOrderCogs) : null);
    }

    public async Task<DashboardOrderSummary> GetDashboardOrderSummaryAsync()
    {
        var start = DhakaTime.LocalToUtc(DashboardToday); var end = start.AddDays(1);
        var counts = await _db.Orders.AsNoTracking().Where(o => !o.IsDraft &&
                ((o.CreatedAt >= start && o.CreatedAt < end && o.OrderStatus != "CANCELLED") ||
                 (o.ReturnedAt >= start && o.ReturnedAt < end)))
            .GroupBy(o => 1).Select(g => new DashboardOrderSummary(
                g.Count(o => o.CreatedAt >= start && o.CreatedAt < end && o.OrderStatus != "CANCELLED"),
                g.Count(o => o.ReturnedAt >= start && o.ReturnedAt < end))).FirstOrDefaultAsync();
        return counts ?? new(0, 0);
    }

    public async Task<SalesCollectionSummary> GetDashboardCollectionsSummaryAsync()
    {
        // Sequential within this request: EF DbContext must not run concurrent queries.
        var collections = await GetSalesCollectionsAsync();
        return collections with { Due = await GetDashboardDueAsync() };
    }

    public async Task<DashboardExpenseSummary> GetDashboardExpenseSummaryAsync()
    {
        var today = DashboardToday; var tomorrow = today.AddDays(1);
        var monthStart = new DateTime(today.Year, today.Month, 1);
        // Both totals share one scoped query; future-dated entries are excluded.
        return await _db.Expenses.AsNoTracking()
            .Where(e => e.Status == "APPROVED" && e.ExpenseDate >= monthStart && e.ExpenseDate < tomorrow)
            .GroupBy(e => 1)
            .Select(g => new DashboardExpenseSummary(
                g.Sum(e => e.ExpenseDate >= today ? e.Amount : 0), g.Sum(e => e.Amount)))
            .FirstOrDefaultAsync() ?? new(0, 0);
    }

    public async Task<decimal> GetDashboardTodayExpenseAsync()
    {
        // ExpenseDate stores the business calendar date, not a UTC payment timestamp.
        var today = DashboardToday; var tomorrow = today.AddDays(1);
        return await _db.Expenses.AsNoTracking()
            .Where(e => e.Status == "APPROVED" && e.ExpenseDate >= today && e.ExpenseDate < tomorrow)
            .SumAsync(e => (decimal?)e.Amount) ?? 0;
    }

    private static DateTime DashboardToday => DhakaTime.UtcToLocal(DateTime.UtcNow).Date;
    private IQueryable<Order> DashboardTodayOrders()
    {
        var start = DhakaTime.LocalToUtc(DashboardToday);
        return _db.Orders.AsNoTracking().Where(OrderFinancials.SoldOrderFilter(start, start.AddDays(1)));
    }

    public Task<int> GetDashboardTodayOrdersAsync() => DashboardTodayOrders().CountAsync();

    public async Task<decimal> GetDashboardTodaySalesAsync()
    {
        var orders = await DashboardTodayOrders().Include(o => o.Items.Where(i => i.DeletedAt == null)).ToListAsync();
        return orders.Sum(OrderFinancials.ComputeOrderRevenue);
    }

    public async Task<decimal> GetDashboardTodayProfitAsync()
    {
        var orders = await DashboardTodayOrders().Include(o => o.Items.Where(i => i.DeletedAt == null)).ToListAsync();
        return orders.Sum(o => OrderFinancials.ComputeOrderRevenue(o) - OrderFinancials.ComputeOrderCogs(o));
    }

    public Task<int> GetDashboardTodayReturnsAsync()
    {
        var start = DhakaTime.LocalToUtc(DashboardToday); var end = start.AddDays(1);
        return _db.Orders.AsNoTracking().CountAsync(o => !o.IsDraft && o.ReturnedAt >= start && o.ReturnedAt < end);
    }

    public async Task<NameValue[]> GetDashboardStockAsync()
    {
        var (low, empty) = await GetStockAlertCountsAsync();
        return [new("LOW", low), new("OUT", empty)];
    }

    private IQueryable<OrderPayment> DashboardRecentPayments()
    {
        var start = DhakaTime.LocalToUtc(DashboardToday.AddDays(-29));
        var end = DhakaTime.LocalToUtc(DashboardToday.AddDays(1));
        return _db.OrderPayments.AsNoTracking().Where(p => p.ReceivedAt >= start && p.ReceivedAt < end)
            .Join(_db.Orders.AsNoTracking().Where(o => !o.IsDraft), p => p.OrderId, o => o.Id, (p, o) => p);
    }

    public async Task<List<DatePoint>> GetDashboardTrendAsync()
    {
        var start = DashboardToday.AddDays(-29);
        var rows = await DashboardRecentPayments().GroupBy(p => p.ReceivedAt.AddHours(6).Date)
            .Select(g => new { Day = g.Key, Total = g.Sum(p => p.Amount) }).ToListAsync();
        return Enumerable.Range(0, 30).Select(i => new DatePoint(start.AddDays(i).ToString("MMM dd"),
            rows.FirstOrDefault(r => r.Day == start.AddDays(i))?.Total ?? 0)).ToList();
    }

    public Task<List<NameValue>> GetDashboardPaymentMethodsAsync() => DashboardRecentPayments()
        .GroupBy(p => p.Method).Select(g => new NameValue(g.Key, g.Sum(p => p.Amount))).ToListAsync();

    private IQueryable<OrderItem> DashboardRecentItems()
    {
        var start = DhakaTime.LocalToUtc(DashboardToday.AddDays(-29));
        var end = DhakaTime.LocalToUtc(DashboardToday.AddDays(1));
        return _db.OrderItems.AsNoTracking()
            .Join(_db.Orders.AsNoTracking().Where(OrderFinancials.SoldOrderFilter(start, end)),
                i => i.OrderId, o => o.Id, (i, o) => i);
    }

    public async Task<List<NameValue>> GetDashboardTopProductsAsync()
    {
        var rows = await DashboardRecentItems().Join(_db.ProductVariants.AsNoTracking(), i => i.VariantId, v => v.Id,
                (i, v) => new { i.Qty, i.UnitPrice, v.ProductId })
            .Join(_db.Products.AsNoTracking(), i => i.ProductId, p => p.Id,
                (i, p) => new { p.Name, Amount = i.Qty * i.UnitPrice }).ToListAsync();
        return rows.GroupBy(r => r.Name).Select(g => new NameValue(g.Key, g.Sum(r => r.Amount)))
            .OrderByDescending(r => r.Value).Take(10).ToList();
    }

    public async Task<List<NameValue>> GetDashboardCategoriesAsync()
    {
        var rows = await DashboardRecentItems().Join(_db.ProductVariants.AsNoTracking(), i => i.VariantId, v => v.Id,
                (i, v) => new { i.Qty, i.UnitPrice, v.ProductId })
            .Join(_db.Products.AsNoTracking(), i => i.ProductId, p => p.Id,
                (i, p) => new { p.CategoryId, Amount = i.Qty * i.UnitPrice })
            .Join(_db.Categories.AsNoTracking(), i => i.CategoryId, c => c.Id,
                (i, c) => new { c.Name, i.Amount }).ToListAsync();
        return rows.GroupBy(r => r.Name).Select(g => new NameValue(g.Key, g.Sum(r => r.Amount)))
            .OrderByDescending(r => r.Value).ToList();
    }
}
