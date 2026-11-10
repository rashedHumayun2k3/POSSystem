using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using ResellerApi.DTOs.Reports;

namespace ResellerApi.Services;

// All dashboard calculations live in Data/Sql/DashboardReports.sql.
// These methods only bind the authenticated scope and map procedure result sets.
public partial class ReportService
{
    private async Task<T> ReadDashboardAsync<T>(string procedure, Func<DbDataReader, Task<T>> read, bool canSeeCosts = false, string? period = null)
    {
        if (_db.CurrentBusinessId == Guid.Empty) throw new InvalidOperationException("A business must be selected.");
        var connection = _db.Database.GetDbConnection();
        var openedHere = connection.State != ConnectionState.Open;
        try
        {
            if (openedHere) await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "dbo." + procedure; // Only internal constant names are accepted by callers.
            command.CommandType = CommandType.StoredProcedure;
            command.CommandTimeout = _db.Database.GetCommandTimeout() ?? 30;
            command.Transaction = _db.Database.CurrentTransaction?.GetDbTransaction();
            void Add(string name, DbType type, object? value)
            {
                var parameter = command.CreateParameter(); parameter.ParameterName = name;
                parameter.DbType = type; parameter.Value = value ?? DBNull.Value; command.Parameters.Add(parameter);
            }
            Add("@BusinessId", DbType.Guid, _db.CurrentBusinessId);
            Add("@BranchId", DbType.Guid, _db.CurrentBranchId);
            Add("@CanSeeCosts", DbType.Boolean, canSeeCosts);
            if (period != null) Add("@Period", DbType.String, period);
            await using var reader = await command.ExecuteReaderAsync();
            return await read(reader);
        }
        finally { if (openedHere) await connection.CloseAsync(); }
    }

    private static decimal Amount(DbDataReader r, string name) => Convert.ToDecimal(r[name]);
    private static int Count(DbDataReader r, string name) => Convert.ToInt32(r[name]);
    private static decimal? OptionalAmount(DbDataReader r, string name) => r[name] is DBNull ? null : Amount(r, name);
    private static async Task Row(DbDataReader r)
    {
        if (!await r.ReadAsync()) throw new InvalidOperationException("Dashboard procedure returned no summary row.");
    }
    private static async Task<List<DatePoint>> Points(DbDataReader r)
    {
        var rows = new List<DatePoint>();
        while (await r.ReadAsync()) rows.Add(new((string)r["Label"], Amount(r, "Value")));
        return rows;
    }
    private Task<List<NameValue>> Names(string procedure) => ReadDashboardAsync(procedure, async r =>
    {
        var rows = new List<NameValue>();
        while (await r.ReadAsync()) rows.Add(new((string)r["Name"], Amount(r, "Value")));
        return rows;
    });

    private Task<(DashboardSalesOverview Overview, int Customers, decimal Units)> ReadSalesOverviewAsync(bool canSeeCosts) =>
        ReadDashboardAsync("DashboardSalesOverview", async r =>
        {
            await Row(r);
            var overview = new DashboardSalesOverview(Amount(r,"TodaySales"), canSeeCosts ? OptionalAmount(r,"TodayProfit") : null,
                Count(r,"TodayOrders"), Amount(r,"YesterdaySales"), OptionalAmount(r,"ChangePercent"), Amount(r,"SevenDaySales"), []);
            var customers = Count(r,"TodayCustomers"); var units = Amount(r,"TodayProductsSold");
            if (!await r.NextResultAsync()) throw new InvalidOperationException("Dashboard procedure returned no daily trend.");
            return (overview with { Days = await Points(r) }, customers, units);
        }, canSeeCosts);

    private Task<DashboardCardSection> ReadCardSectionAsync(string procedure, bool canSeeCosts, string period)
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) throw new ArgumentException("Invalid dashboard period.");
        return ReadDashboardAsync(procedure, async r =>
        {
            var json = new System.Text.StringBuilder();
            while (await r.ReadAsync()) json.Append(r.GetString(0));
            return System.Text.Json.JsonSerializer.Deserialize<DashboardCardSection>(json.ToString())
                ?? throw new InvalidOperationException("Missing dashboard card result.");
        }, canSeeCosts, period);
    }

    public Task<DashboardCardSection> GetDashboardMoneySectionAsync() => ReadDashboardAsync("DashboardMoneySection", async r =>
    {
        var json = new System.Text.StringBuilder();
        while (await r.ReadAsync()) json.Append(r.GetString(0));
        return System.Text.Json.JsonSerializer.Deserialize<DashboardCardSection>(json.ToString())
            ?? throw new InvalidOperationException("Missing current money result.");
    });
    public Task<DashboardCardSection> GetDashboardExpenseSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardExpenseSection", canSeeCosts, period);
    public Task<DashboardCardSection> GetDashboardCollectionSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardCollectionSection", canSeeCosts, period);
    public Task<DashboardCardSection> GetDashboardProfitSectionAsync(bool canSeeCosts, string period)
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH")) throw new ArgumentException("Invalid profit period.");
        return ReadCardSectionAsync("DashboardProfitSection", canSeeCosts, period);
    }
    public Task<DashboardCardSection> GetDashboardOrdersSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardOrdersSection", canSeeCosts, period);
    public Task<DashboardCardSection> GetDashboardProductsSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardProductsSection", canSeeCosts, period);
    public Task<DashboardCardSection> GetDashboardCapitalSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardCapitalSection", canSeeCosts, period);
    public Task<DashboardCardSection> GetDashboardDuesSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardDuesSection", canSeeCosts, period);
    public Task<DashboardCardSection> GetDashboardTopSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardTopSection", canSeeCosts, period);
    public Task<DashboardCardSection> GetDashboardCounterSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardCounterSection", canSeeCosts, period);
    public Task<DashboardCardSection> GetDashboardTransitSectionAsync(bool canSeeCosts, string period) => ReadCardSectionAsync("DashboardTransitSection", canSeeCosts, period);

    public Task<DashboardSalesSection> GetDashboardSalesSectionAsync(bool canSeeCosts, string period)
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH")) throw new ArgumentException("Invalid sales period.");
        return ReadDashboardAsync("DashboardSalesSection", async r =>
        {
            await Row(r);
            var result = new DashboardSalesSection(Amount(r,"Sales"), canSeeCosts ? OptionalAmount(r,"Profit") : null,
                Count(r,"Orders"), Amount(r,"ItemsSold"), Amount(r,"AverageBill"), canSeeCosts ? OptionalAmount(r,"Margin") : null,
                OptionalAmount(r,"ChangePercent"), [], []) { PreviousSales = Amount(r,"PreviousSales") };
            if (!await r.NextResultAsync()) throw new InvalidOperationException("Missing sales chart.");
            var chart = await Points(r);
            if (!await r.NextResultAsync()) throw new InvalidOperationException("Missing sales channels.");
            var channels = new List<DashboardSalesChannel>();
            while (await r.ReadAsync()) channels.Add(new((string)r["Channel"], Count(r,"Orders"), Amount(r,"Sales"), Amount(r,"Share")));
            return result with { Chart = chart, Channels = channels };
        }, canSeeCosts, period);
    }

    public async Task<DashboardSalesOverview> GetDashboardSalesOverviewAsync(bool canSeeCosts) => (await ReadSalesOverviewAsync(canSeeCosts)).Overview;
    public async Task<DashboardFinancialSummary> GetDashboardFinancialSummaryAsync(bool canSeeCosts)
    {
        var result = await GetDashboardSalesOverviewAsync(canSeeCosts);
        return new(result.TodaySales, result.TodayProfit);
    }
    public Task<DashboardOrderSummary> GetDashboardOrderSummaryAsync() => ReadDashboardAsync("DashboardOrders", async r =>
    { await Row(r); return new DashboardOrderSummary(Count(r,"Orders"), Count(r,"Returns")); });
    public Task<DashboardExpenseSummary> GetDashboardExpenseSummaryAsync() => ReadDashboardAsync("DashboardExpenses", async r =>
    { await Row(r); return new DashboardExpenseSummary(Amount(r,"TodayCost"), Amount(r,"MonthCost")); });
    public Task<SalesCollectionSummary> GetDashboardCollectionsSummaryAsync() => ReadDashboardAsync("DashboardCollections", async r =>
    { await Row(r); return new SalesCollectionSummary(Amount(r,"Cash"), Amount(r,"Bkash"), Amount(r,"Nagad"), Amount(r,"Card"), Amount(r,"Due")); });
    public Task<NameValue[]> GetDashboardStockAsync() => ReadDashboardAsync("DashboardStock", async r =>
    { await Row(r); return new NameValue[] { new("LOW", Amount(r,"LowStock")), new("OUT", Amount(r,"OutOfStock")) }; });
    public Task<List<DatePoint>> GetDashboardTrendAsync() => ReadDashboardAsync("DashboardTrend", Points);
    public Task<List<NameValue>> GetDashboardTopProductsAsync() => Names("DashboardTopProducts");
    public Task<List<NameValue>> GetDashboardPaymentMethodsAsync() => Names("DashboardPaymentMethods");
    public Task<List<NameValue>> GetDashboardCategoriesAsync() => Names("DashboardCategories");
    public async Task<decimal> GetDashboardTodayExpenseAsync() => (await GetDashboardExpenseSummaryAsync()).TodayCost;
    public async Task<int> GetDashboardTodayOrdersAsync() => (await GetDashboardOrderSummaryAsync()).Orders;
    public async Task<int> GetDashboardTodayReturnsAsync() => (await GetDashboardOrderSummaryAsync()).Returns;
    public async Task<decimal> GetDashboardTodaySalesAsync() => (await GetDashboardSalesOverviewAsync(false)).TodaySales;
    public async Task<decimal> GetDashboardTodayProfitAsync() => (await GetDashboardSalesOverviewAsync(true)).TodayProfit ?? 0;
    public Task<SalesCollectionSummary> GetSalesCollectionsAsync() => GetDashboardCollectionsSummaryAsync();
    public async Task<decimal> GetDashboardDueAsync() => (await GetDashboardCollectionsSummaryAsync()).Due;

    // Compatibility endpoint for older clients; the current UI requests each group independently.
    // Calls remain sequential here because all commands share a scoped EF connection.
    public async Task<DashboardKpiDto> GetDashboardAsync(bool canSeeCosts)
    {
        var (sales, customers, units) = await ReadSalesOverviewAsync(canSeeCosts);
        var orders = await GetDashboardOrderSummaryAsync(); var stock = await GetDashboardStockAsync();
        var trend = await GetDashboardTrendAsync(); var products = await GetDashboardTopProductsAsync();
        var methods = await GetDashboardPaymentMethodsAsync(); var hourly = await ReadDashboardAsync("DashboardHourly", Points);
        var categories = await GetDashboardCategoriesAsync(); var collections = await GetDashboardCollectionsSummaryAsync();
        return new(sales.TodaySales, sales.TodayOrders, sales.TodayProfit ?? 0, customers, units, orders.Returns,
            (int)stock[0].Value, (int)stock[1].Value, trend, products, methods, hourly, categories, collections);
    }
}
