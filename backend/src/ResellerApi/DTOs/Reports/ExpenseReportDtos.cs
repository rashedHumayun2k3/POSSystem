namespace ResellerApi.DTOs.Reports;

public record ExpenseReportCategoryDto(Guid CategoryId, string Name, decimal Amount, int Count);
public record ExpenseReportFundingDto(string Source, decimal Amount, int Count);
public record ExpenseReportItemDto(Guid Id, DateTime ExpenseDate, string SubType, string? Title, string CategoryName,
    decimal Amount, string Status, string? FundingSource, string CreatedByName, string? Note,
    string Source = "EXPENSE", Guid? TripId = null, string? PoNumber = null, Guid? LotId = null, string? LotNo = null,
    string? PayerName = null, DateTime? PaidAt = null);
public record ExpenseReportDto(DateTime From, DateTime To, decimal ApprovedTotal, int ApprovedCount,
    decimal PendingTotal, int PendingCount, decimal RejectedTotal, int RejectedCount,
    List<ExpenseReportCategoryDto> ByCategory, List<ExpenseReportFundingDto> ByFundingSource,
    List<ExpenseReportItemDto> Items, int TotalItems, int Page, int PageSize);
