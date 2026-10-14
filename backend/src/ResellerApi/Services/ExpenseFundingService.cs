using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using ResellerApi.Data;
using ResellerApi.DTOs.Expenses;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Services;

public class ExpenseFundingService(AppDbContext db, IBusinessContext business)
{
    public static long ToPaisa(decimal amount)
    {
        if (amount < 0 || amount > 999999999999.99m || decimal.Round(amount, 2) != amount)
            throw new ArgumentException("Enter a valid amount with at most two decimal places.");
        return checked((long)(amount * 100));
    }

    // Shared with all expense mutations: concurrent approvals cannot overspend the fund.
    public async Task<IDbContextTransaction?> BeginAsync()
    {
        if (!db.Database.IsRelational()) return null;
        var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        try
        {
            if (db.Database.IsSqlServer())
            {
                var resource = $"expense-funding:{business.CurrentBusinessId}";
                await db.Database.ExecuteSqlInterpolatedAsync($@"DECLARE @result int;
                    EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
                    IF @result < 0 THROW 51000, 'Another expense is being saved. Please retry.', 1;");
            }
            return tx;
        }
        catch { await tx.DisposeAsync(); throw; }
    }

    public async Task LockInExistingTransactionAsync()
    {
        if (!db.Database.IsSqlServer()) return;
        var resource = $"expense-funding:{business.CurrentBusinessId}";
        await db.Database.ExecuteSqlInterpolatedAsync($@"DECLARE @result int;
            EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
            IF @result < 0 THROW 51000, 'Financial period is busy. Please retry.', 1;");
    }

    public async Task<AccountingPeriodClosing?> LatestClosingAsync() => await db.AccountingPeriodClosings
        .AsNoTracking().OrderByDescending(x => x.PeriodEnd).FirstOrDefaultAsync();

    private async Task<(long Capital, long Expenses, List<CapitalInjection> Injections, List<Expense> ExpenseRows)> MovementsAsync(DateTime start, DateTime end)
    {
        var id = business.CurrentBusinessId;
        var investments = await db.CapitalInjections.IgnoreQueryFilters().AsNoTracking()
            .Where(i => i.BusinessId == id && i.DeletedAt == null && i.Status == "APPROVED" && i.ExpenseId == null
                && i.InjectedAt >= start && i.InjectedAt < end)
            .ToListAsync();
        var expenses = await db.Expenses.IgnoreQueryFilters().AsNoTracking()
            .Where(e => e.BusinessId == id && e.DeletedAt == null && e.FundingSource != "PERSONAL"
                && (e.Status == "APPROVED" || e.PettyCashBoxId != null && e.Status == "PENDING")
                && e.ExpenseDate >= start && e.ExpenseDate < end)
            .ToListAsync();
        return (investments.Sum(i => i.AmountPaisa), expenses.Sum(e => ToPaisa(e.Amount)), investments, expenses);
    }

    public async Task<long> BalanceAsync()
    {
        var last = await LatestClosingAsync();
        var movements = await MovementsAsync(last?.PeriodEnd.AddDays(1) ?? DateTime.MinValue, DateTime.MaxValue);
        return (last?.ClosingBalancePaisa ?? 0) + movements.Capital - movements.Expenses;
    }

    public async Task<FundingClosingPreview> PreviewAsync(DateTime through)
    {
        if (through.TimeOfDay != TimeSpan.Zero || through.Date >= DateTime.UtcNow.Date)
            throw new ArgumentException("Choose a completed date before today.");
        var last = await LatestClosingAsync();
        if (last != null && through <= last.PeriodEnd)
            throw new ArgumentException("Closing date must be after the last closed period.");
        var start = last?.PeriodEnd.AddDays(1) ?? DateTime.MinValue;
        var end = through.AddDays(1);
        var movements = await MovementsAsync(start, end);
        var pendingInjections = await db.CapitalInjections.IgnoreQueryFilters().CountAsync(i =>
            i.BusinessId == business.CurrentBusinessId && i.DeletedAt == null && i.Status == "PENDING_APPROVAL" && i.InjectedAt < end);
        var pendingExpenseItems = await db.Expenses.IgnoreQueryFilters().AsNoTracking()
            .Where(e => e.BusinessId == business.CurrentBusinessId && e.DeletedAt == null && e.Status == "PENDING" && e.ExpenseDate < end)
            .OrderBy(e => e.ExpenseDate)
            .Select(e => new PendingClosingExpense(e.Id, e.SubType, e.Amount, e.ExpenseDate, e.Note, e.FundingSource))
            .ToListAsync();
        return new FundingClosingPreview(start == DateTime.MinValue ? null : start, through,
            (last?.ClosingBalancePaisa ?? 0) / 100m, movements.Capital / 100m, movements.Expenses / 100m,
            ((last?.ClosingBalancePaisa ?? 0) + movements.Capital - movements.Expenses) / 100m,
            pendingInjections, pendingExpenseItems.Count, pendingExpenseItems);
    }

    public async Task<AccountingPeriodClosing> CloseAsync(DateTime through, string? note, Guid userId)
    {
        await using var tx = await BeginAsync();
        var preview = await PreviewAsync(through);
        if (preview.PendingInjections > 0 || preview.PendingExpenses > 0)
            throw new InvalidOperationException("Resolve pending installments and expenses dated in this period before closing.");
        var movements = await MovementsAsync(preview.PeriodStart ?? DateTime.MinValue, through.AddDays(1));
        var closing = new AccountingPeriodClosing {
            BusinessId = business.CurrentBusinessId, PeriodStart = preview.PeriodStart ?? DateTime.MinValue,
            PeriodEnd = through, OpeningBalancePaisa = checked((long)(preview.OpeningBalance * 100m)),
            ApprovedCashPaisa = movements.Capital, BusinessExpensePaisa = movements.Expenses,
            ClosingBalancePaisa = checked((long)(preview.ClosingBalance * 100m)), ClosedBy = userId,
            ClosedAt = DateTime.UtcNow, Note = note?.Trim()
        };
        db.AccountingPeriodClosings.Add(closing);
        foreach (var item in movements.Injections)
            db.BusinessFundLedgerEntries.Add(new BusinessFundLedgerEntry {
                BusinessId = business.CurrentBusinessId, ClosingId = closing.Id,
                PostingDate = item.InjectedAt.Date, OriginalDate = item.InjectedAt.Date,
                MovementType = "CASH_INVESTMENT", AmountPaisa = item.AmountPaisa,
                SourceType = "CapitalInjection", SourceId = item.Id, CreatedBy = userId
            });
        foreach (var item in movements.ExpenseRows)
            db.BusinessFundLedgerEntries.Add(new BusinessFundLedgerEntry {
                BusinessId = business.CurrentBusinessId, ClosingId = closing.Id,
                PostingDate = item.ExpenseDate.Date, OriginalDate = item.ExpenseDate.Date,
                MovementType = "BUSINESS_EXPENSE", AmountPaisa = -ToPaisa(item.Amount),
                SourceType = "Expense", SourceId = item.Id, CreatedBy = userId
            });
        await db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        return closing;
    }

    public async Task EnsureDateOpenAsync(DateTime date)
    {
        var last = await LatestClosingAsync();
        if (last != null && date.Date <= last.PeriodEnd.Date)
            throw new InvalidOperationException("This date is in a closed period. Record an adjustment in the current period instead.");
    }

    public Task<Partner?> PartnerAsync(Guid userId) => db.Partners.AsNoTracking()
        .SingleOrDefaultAsync(p => p.LinkedUserId == userId && p.Status == "ACTIVE");

    public async Task<ExpenseFundingDto> GetAsync(Guid userId, bool owner, bool canViewBalance)
    {
        var balance = await BalanceAsync();
        var partner = await PartnerAsync(userId);
        var canInvest = await db.Partners.AnyAsync(p => p.Status == "ACTIVE" && p.PartnerType == "MANAGING");
        return new(true, canViewBalance ? balance / 100m : null,
            canInvest ? partner?.Id : null, canInvest ? partner?.Name : null, false);
    }

    public async Task CheckBusinessPaymentAsync(decimal amount)
    {
        if (await BalanceAsync() < ToPaisa(amount))
            throw new InvalidOperationException("Insufficient business capital balance. Refresh the balance or choose a personal payment.");
    }

    public async Task AddPersonalInvestmentAsync(Expense expense)
    {
        if (expense.FundingSource != "PERSONAL") return;
        if (!await db.Partners.AnyAsync(p => p.Id == expense.FundingPartnerId && p.Status == "ACTIVE"))
            throw new InvalidOperationException("The paying partner must be active.");
        if (!await db.Partners.AnyAsync(p => p.Status == "ACTIVE" && p.PartnerType == "MANAGING"))
            throw new InvalidOperationException("An active managing partner is required to review the investment.");
        if (await db.CapitalInjections.AnyAsync(i => i.ExpenseId == expense.Id)) return;
        db.CapitalInjections.Add(new CapitalInjection
        {
            BusinessId = expense.BusinessId, PartnerId = expense.FundingPartnerId!.Value,
            ExpenseId = expense.Id, AmountPaisa = ToPaisa(expense.Amount),
            InjectedAt = expense.ExpenseDate, LockInMonths = 0, LockInExpiresAt = expense.ExpenseDate,
            PaymentMethod = "DIRECT_EXPENSE", PaidTo = "Expense: " + expense.SubType,
            Note = $"Personal payment for expense {expense.Id}. Supplier paid directly; no business cash received.",
            Status = "PENDING_APPROVAL", SubmittedAt = DateTime.UtcNow, SubmittedBy = expense.CreatedBy,
            CreatedBy = expense.CreatedBy
        });
    }
}
