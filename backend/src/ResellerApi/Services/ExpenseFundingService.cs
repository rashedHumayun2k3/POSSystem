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

    private async Task<long> RecordedNetAsync()
    {
        // These are business-wide amounts, including every branch. An expense paid directly
        // by a partner increases their investment after approval but never adds cash here.
        var id = business.CurrentBusinessId;
        var capital = await db.CapitalInjections.IgnoreQueryFilters()
            .Where(i => i.BusinessId == id && i.DeletedAt == null && i.Status == "APPROVED" && i.ExpenseId == null)
            .SumAsync(i => (long?)i.AmountPaisa) ?? 0;
        var expenses = await db.Expenses.IgnoreQueryFilters()
            .Where(e => e.BusinessId == id && e.DeletedAt == null && e.FundingSource != "PERSONAL"
                && (e.Status == "APPROVED" || e.PettyCashBoxId != null && e.Status == "PENDING"))
            .SumAsync(e => (decimal?)e.Amount) ?? 0;
        return capital - checked((long)decimal.Round(expenses * 100, 0));
    }

    public async Task<long?> BalanceAsync()
    {
        var account = await db.BusinessExpenseFunds.AsNoTracking().SingleOrDefaultAsync();
        return account == null ? null : account.OpeningBalancePaisa + await RecordedNetAsync() - account.RecordedNetPaisaAtOpening;
    }

    public Task<Partner?> PartnerAsync(Guid userId) => db.Partners.AsNoTracking()
        .SingleOrDefaultAsync(p => p.LinkedUserId == userId && p.Status == "ACTIVE");

    public async Task<ExpenseFundingDto> GetAsync(Guid userId, bool owner, bool canViewBalance)
    {
        var balance = await BalanceAsync();
        var partner = await PartnerAsync(userId);
        var canInvest = await db.Partners.AnyAsync(p => p.Status == "ACTIVE" && p.PartnerType == "MANAGING");
        return new(balance.HasValue, canViewBalance ? balance / 100m : null,
            canInvest ? partner?.Id : null, canInvest ? partner?.Name : null, owner);
    }

    public async Task InitializeAsync(decimal amount, Guid userId)
    {
        var paisa = ToPaisa(amount);
        await using var tx = await BeginAsync();
        if (await db.BusinessExpenseFunds.AnyAsync())
            throw new InvalidOperationException("The opening balance has already been set.");
        db.BusinessExpenseFunds.Add(new BusinessExpenseFund
        {
            BusinessId = business.CurrentBusinessId, OpeningBalancePaisa = paisa,
            RecordedNetPaisaAtOpening = await RecordedNetAsync(), InitializedBy = userId
        });
        await db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
    }

    public async Task CheckBusinessPaymentAsync(decimal amount, bool requireOpening)
    {
        var balance = await BalanceAsync();
        if (!balance.HasValue)
        {
            if (requireOpening) throw new InvalidOperationException("Ask the owner to enter the opening business capital balance first.");
            return; // Compatibility for historical clients before the one-time setup.
        }
        if (balance.Value < ToPaisa(amount))
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
