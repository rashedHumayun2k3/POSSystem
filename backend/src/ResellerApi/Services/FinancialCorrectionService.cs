using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public record FinancialCorrectionRequest(decimal? Amount, bool Cancel, DateTime ExpectedUpdatedAt);

public class FinancialCorrectionService(AppDbContext db, IBusinessContext business, IActivityLogService log)
{
    public async Task CorrectAsync(Guid id, bool installment, FinancialCorrectionRequest request, Guid userId, bool owner)
    {
        if (!request.Cancel && (!request.Amount.HasValue || request.Amount <= 0))
            throw new ArgumentException("Enter an amount greater than zero.");
        var paisa = request.Cancel ? 0 : ExpenseFundingService.ToPaisa(request.Amount!.Value);
        var funding = new ExpenseFundingService(db, business);
        await using var tx = await funding.BeginAsync();
        CapitalInjection? injection = null;
        Expense? expense = null;
        if (installment)
        {
            injection = await db.CapitalInjections.FirstOrDefaultAsync(i => i.Id == id && i.BusinessId == business.CurrentBusinessId)
                ?? throw new KeyNotFoundException("Installment not found.");
            if (injection.ExpenseId.HasValue)
                expense = await db.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == injection.ExpenseId && e.BusinessId == business.CurrentBusinessId && e.DeletedAt == null)
                    ?? throw new InvalidOperationException("The linked expense is unavailable.");
        }
        else
        {
            expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == id && e.BusinessId == business.CurrentBusinessId)
                ?? throw new KeyNotFoundException("Expense not found.");
            injection = await db.CapitalInjections.FirstOrDefaultAsync(i => i.ExpenseId == id && i.BusinessId == business.CurrentBusinessId);
        }
        var creator = installment ? injection!.CreatedBy : expense!.CreatedBy;
        if (creator != userId && (!installment || !owner))
            throw new UnauthorizedAccessException(installment ? "Only the creator or business owner can change this installment." : "Only the creator can change this expense.");
        if ((installment ? injection!.UpdatedAt : expense!.UpdatedAt) != request.ExpectedUpdatedAt)
            throw new InvalidOperationException("This record has changed. Refresh it before trying again.");
        if (expense?.Status == "CANCELLED" || injection?.Status == "CANCELLED")
            throw new InvalidOperationException("This record is already cancelled.");
        if (expense != null) await funding.EnsureDateOpenAsync(expense.ExpenseDate);
        if (injection != null) await funding.EnsureDateOpenAsync(injection.InjectedAt);
        if (injection is { ExpenseId: null, Status: "APPROVED" } && await funding.BalanceAsync() < injection.AmountPaisa)
            throw new InvalidOperationException("This capital has already been spent. Restore sufficient business funds before changing it.");
        var votes = injection == null ? new List<CapitalInjectionApprovalVote>() : await db.CapitalInjectionApprovalVotes.Where(v => v.CapitalInjectionId == injection.Id).ToListAsync();
        var before = new {
            Expense = expense == null ? null : new { expense.Id, expense.Amount, expense.Status, expense.ApprovedBy, expense.PaidAt, expense.CreatedBy },
            Installment = injection == null ? null : new { injection.Id, injection.AmountPaisa, injection.Status, injection.ApprovedBy, injection.ApprovedAt, injection.RejectionReason, injection.CreatedBy },
            Votes = votes.Select(v => new { v.Id, v.VotedByPartnerId, v.Decision, v.Note, v.VotedAt }).ToArray()
        };
        if (injection != null)
        {
            var posted = await db.CapitalLedgerEntries.Where(l => l.ReferenceType == "CapitalInjection" && l.ReferenceId == injection.Id).SumAsync(l => (long?)l.AmountPaisa) ?? 0;
            if (posted != 0)
            {
                var balance = await db.CapitalLedgerEntries.Where(l => l.PartnerId == injection.PartnerId && l.Bucket == "CAPITAL").SumAsync(l => (long?)l.AmountPaisa) ?? 0;
                db.CapitalLedgerEntries.Add(new CapitalLedgerEntry {
                    BusinessId = business.CurrentBusinessId, PartnerId = injection.PartnerId, Bucket = "CAPITAL", EntryType = "CORRECTION",
                    AmountPaisa = -posted, BalanceAfterPaisa = balance - posted, ReferenceType = "CapitalInjection", ReferenceId = injection.Id,
                    Note = request.Cancel ? "Cancelled installment: reversal" : "Amount correction: reversal pending fresh approval", CreatedBy = userId
                });
            }
            // Votes are archived in the audit entry before removal; the unique voter key can then be reused.
            db.CapitalInjectionApprovalVotes.RemoveRange(votes);
            if (!request.Cancel) injection.AmountPaisa = paisa;
            injection.Status = request.Cancel ? "CANCELLED" : expense != null ? "PENDING_EXPENSE" : "PENDING_APPROVAL";
            injection.SubmittedBy = userId; injection.SubmittedAt = DateTime.UtcNow;
            injection.ApprovedBy = null; injection.ApprovedAt = null;
            injection.RejectedBy = null; injection.RejectedAt = null; injection.RejectionReason = null;
        }
        if (expense != null)
        {
            if (expense.PettyCashBoxId.HasValue)
            {
                var box = await db.PettyCashBoxes.FirstAsync(b => b.Id == expense.PettyCashBoxId);
                var reserved = expense.Status is "PENDING" or "APPROVED" ? expense.Amount : 0;
                var adjustment = reserved - (request.Cancel ? 0 : request.Amount!.Value);
                if (box.Balance + adjustment < 0) throw new InvalidOperationException("Insufficient petty cash balance for this correction.");
                box.Balance += adjustment;
                if (adjustment != 0) db.PettyCashTxns.Add(new PettyCashTxn { BusinessId = business.CurrentBusinessId, BoxId = box.Id,
                    TxnType = adjustment > 0 ? "FUND_IN" : "SPEND", Amount = Math.Abs(adjustment), ExpenseId = expense.Id, UserId = userId, Note = "Expense correction" });
            }
            if (!request.Cancel) expense.Amount = request.Amount!.Value;
            expense.Status = request.Cancel ? "CANCELLED" : "PENDING";
            expense.ApprovedBy = null; expense.PaidAt = null; expense.RejectionReason = null;
        }
        await db.SaveChangesAsync();
        if (!request.Cancel && expense != null && await funding.IsOnlyApprovingMemberAsync(userId))
        {
            if (expense.FundingSource != "PERSONAL" && !expense.PettyCashBoxId.HasValue)
                await funding.CheckBusinessPaymentAsync(expense.Amount);
            expense.Status = "APPROVED"; expense.ApprovedBy = userId; expense.PaidAt = DateTime.UtcNow;
            await funding.AddPersonalInvestmentAsync(expense);
            await db.SaveChangesAsync();
        }
        var action = request.Cancel ? "CANCEL" : "CORRECT";
        var after = new { request.Amount, request.Cancel, ExpenseStatus = expense?.Status, InstallmentStatus = injection?.Status };
        if (expense != null) await log.LogAsync(business.CurrentBusinessId, userId, action, "Expense", expense.Id, before, after);
        if (injection != null) await log.LogAsync(business.CurrentBusinessId, userId, action, "CapitalInjection", injection.Id, before, after);
        if (tx != null) await tx.CommitAsync();
    }
}
