namespace ResellerApi.DTOs.Expenses;

// ── Category ─────────────────────────────────────────────────────────────────
public record ExpenseCategoryDto(
    Guid Id,
    string Code,
    string Name,
    bool IsSystem,
    bool IsDefault,
    bool IsActive
);

// ── Expense list / detail ─────────────────────────────────────────────────────
public record ExpenseDto(
    Guid Id,
    Guid CategoryId,
    string CategoryName,
    string SubType,
    decimal Amount,
    DateTime ExpenseDate,
    Guid? StaffId,
    string? StaffName,
    bool IsRecurring,
    int? RecurringDay,
    Guid? AllocateToTripId,
    Guid? PettyCashBoxId,
    string? PhotoUrl,
    string Status,
    DateTime? PaidAt,
    Guid CreatedBy,
    string CreatedByName,
    Guid? ApprovedBy,
    string? ApprovedByName,
    string? Note,
    string? RejectionReason,
    DateTime CreatedAt,
    string? FundingSource = null,
    string? FundingPartnerName = null,
    Guid? FundingPartnerId = null,
    Guid? PersonalInvestmentId = null,
    DateTime UpdatedAt = default,
    bool IsAccountingPeriodClosed = false
)
{
    public Guid? LastCorrectedBy { get; init; }
    public string? Title { get; init; }
}

// ── Create ────────────────────────────────────────────────────────────────────
public record CreateExpenseRequest(
    Guid CategoryId,
    string SubType,
    decimal Amount,
    DateTime ExpenseDate,
    Guid? StaffId,
    bool IsRecurring,
    int? RecurringDay,
    Guid? AllocateToTripId,
    Guid? PettyCashBoxId,
    string? PhotoUrl,
    string? Note,
    Guid? BranchId = null,
    string? FundingSource = null,
    Guid? RequestId = null,
    string? Title = null
);

public record ExpenseFundingDto(bool Initialized, decimal? Balance, Guid? PartnerId, string? PartnerName, bool CanInitialize);
public record FundingClosingPreview(DateTime? PeriodStart, DateTime PeriodEnd, decimal OpeningBalance,
    decimal ApprovedCash, decimal BusinessExpenses, decimal ClosingBalance, int PendingInjections, int PendingExpenses,
    IReadOnlyList<PendingClosingExpense> PendingExpenseItems);
public record PendingClosingExpense(Guid Id, string SubType, decimal Amount, DateTime ExpenseDate, string? Note, string? FundingSource);
public record CloseFundingPeriodRequest(DateTime Through, string? Note);
public record InitializeExpenseFundRequest(decimal OpeningBalance);

// ── Update ────────────────────────────────────────────────────────────────────
public record UpdateExpenseRequest(
    Guid CategoryId,
    string SubType,
    decimal Amount,
    DateTime ExpenseDate,
    Guid? StaffId,
    bool IsRecurring,
    int? RecurringDay,
    Guid? AllocateToTripId,
    Guid? PettyCashBoxId,
    string? PhotoUrl,
    string? Note
);

// ── Approval ──────────────────────────────────────────────────────────────────
public record ApproveExpenseRequest(string? Note);
public record RejectExpenseRequest(string Reason);

// ── Petty Cash ────────────────────────────────────────────────────────────────
public record PettyCashBoxDto(
    Guid Id,
    Guid StaffId,
    string StaffName,
    decimal Balance,
    DateTime CreatedAt
);

public record FundPettyCashRequest(decimal Amount, string? Note);
public record AdjustPettyCashRequest(decimal NewBalance, string? Note);

public record PettyCashTxnDto(
    Guid Id,
    string TxnType,
    decimal Amount,
    Guid? ExpenseId,
    string? ExpenseSubType,
    Guid UserId,
    string UserName,
    string? Note,
    DateTime CreatedAt
);

// ── Planned Rates ─────────────────────────────────────────────────────────────
public record PlannedRateDto(
    Guid Id,
    string Scope,
    Guid? ScopeId,
    string RateType,
    decimal RatePerUnit,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo,
    Guid SetBy,
    string SetByName,
    DateTime CreatedAt
);

public record SetPlannedRateRequest(
    string Scope,
    Guid? ScopeId,
    string RateType,
    decimal RatePerUnit,
    DateTime EffectiveFrom
);

// ── Marketing Budget ──────────────────────────────────────────────────────────
public record MarketingBudgetDto(
    Guid Id,
    int Year,
    int Month,
    string Scope,
    Guid? ScopeId,
    decimal BudgetAmount,
    Guid SetBy,
    string SetByName
);

public record SetMarketingBudgetRequest(
    int Year,
    int Month,
    string Scope,
    Guid? ScopeId,
    decimal BudgetAmount
);

// ── List filter ───────────────────────────────────────────────────────────────
public record ExpenseListRequest(
    string? Status,
    Guid? CategoryId,
    DateTime? From,
    DateTime? To,
    int Page,
    int PageSize
);

public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);
