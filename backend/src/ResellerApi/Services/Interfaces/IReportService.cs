using ResellerApi.DTOs.Reports;

namespace ResellerApi.Services.Interfaces;

public interface IReportService
{
    Task<decimal> GetDashboardTodaySalesAsync();
    Task<int> GetDashboardTodayOrdersAsync();
    Task<decimal> GetDashboardTodayProfitAsync();
    Task<int> GetDashboardTodayReturnsAsync();
    Task<NameValue[]> GetDashboardStockAsync();
    Task<SalesCollectionSummary> GetSalesCollectionsAsync();
    Task<decimal> GetDashboardDueAsync();
    Task<List<DatePoint>> GetDashboardTrendAsync();
    Task<List<NameValue>> GetDashboardTopProductsAsync();
    Task<List<NameValue>> GetDashboardPaymentMethodsAsync();
    Task<List<NameValue>> GetDashboardCategoriesAsync();
    Task<DashboardFinancialSummary> GetDashboardFinancialSummaryAsync(bool canSeeCosts);
    Task<DashboardOrderSummary> GetDashboardOrderSummaryAsync();
    Task<SalesCollectionSummary> GetDashboardCollectionsSummaryAsync();
    Task<decimal> GetDashboardTodayExpenseAsync();
    Task<DashboardExpenseSummary> GetDashboardExpenseSummaryAsync();
    Task<DashboardSalesOverview> GetDashboardSalesOverviewAsync(bool canSeeCosts);
    Task<DashboardKpiDto> GetDashboardAsync(bool canSeeCosts);
    Task<HomeSummaryDto> GetHomeSummaryAsync(bool canSeeCosts);
    Task<HomeTodayMetricsDto> GetHomeTodayMetricsAsync(bool canSeeCosts);
    Task<SalesSummaryDto> GetSalesSummaryAsync(DateTime from, DateTime to, string groupBy);
    Task<InventoryReportDto> GetInventoryReportAsync(DateTime from, DateTime to, string groupBy, bool canSeeCosts);
    Task<PnlReportDto> GetPnlReportAsync(DateTime from, DateTime to, string groupBy, bool canSeeCosts);
    Task<OrdersReportDto> GetOrdersReportAsync(DateTime from, DateTime to, string groupBy);
    Task<DailyClosingReportDto> GetDailyClosingReportAsync(DateTime date, bool canSeeCosts);
    Task<StockValuationResponseDto> GetStockValuationReportAsync(
        DateTime fromUtc, DateTime toExclusiveUtc, DateTime rangeFromDate, DateTime rangeToDate, string rangeLabel,
        Guid? categoryId);
}
