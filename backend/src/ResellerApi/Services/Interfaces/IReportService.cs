using ResellerApi.DTOs.Reports;

namespace ResellerApi.Services.Interfaces;

public interface IReportService
{
    Task<DashboardKpiDto> GetDashboardAsync(bool canSeeCosts);
    Task<HomeSummaryDto> GetHomeSummaryAsync(bool canSeeCosts);
    Task<SalesSummaryDto> GetSalesSummaryAsync(DateTime from, DateTime to, string groupBy);
    Task<InventoryReportDto> GetInventoryReportAsync(DateTime from, DateTime to, string groupBy, bool canSeeCosts);
    Task<PnlReportDto> GetPnlReportAsync(DateTime from, DateTime to, string groupBy, bool canSeeCosts);
    Task<OrdersReportDto> GetOrdersReportAsync(DateTime from, DateTime to, string groupBy);
    Task<DailyClosingReportDto> GetDailyClosingReportAsync(DateTime date, bool canSeeCosts);
    Task<StockValuationResponseDto> GetStockValuationReportAsync(
        DateTime fromUtc, DateTime toExclusiveUtc, DateTime rangeFromDate, DateTime rangeToDate, string rangeLabel,
        Guid? categoryId);
}
