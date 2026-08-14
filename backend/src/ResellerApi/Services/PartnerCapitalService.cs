using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Partners;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PartnerCapitalService : IPartnerCapitalService
{
    private static readonly HashSet<string> ValidPaymentMethods = new() { "CASH", "BANK", "CHEQUE", "MOBILE_BANKING" };
    private static readonly HashSet<string> ValidApprovalDecisions = new() { "APPROVE", "REJECT" };

    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public PartnerCapitalService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
    }

    public async Task<CapitalInjectionDto> RecordInjectionAsync(Guid partnerId, CreateCapitalInjectionRequest request, Guid userId)
    {
        ValidateInjectionRequest(request);

        var partner = await _db.Partners.FirstOrDefaultAsync(p => p.Id == partnerId)
            ?? throw new KeyNotFoundException("Partner not found.");
        if (partner.Status != "ACTIVE")
            throw new InvalidOperationException("Capital injections can only be drafted for an ACTIVE partner.");

        var injection = BuildInjection(partnerId, request, userId);

        _db.CapitalInjections.Add(injection);
        await _db.SaveChangesAsync();

        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "CapitalInjectionDraft", injection.Id);
        return ToDto(injection);
    }

    public async Task<CapitalInjectionDto> UpdateInjectionAsync(Guid partnerId, Guid injectionId, CreateCapitalInjectionRequest request, Guid userId)
    {
        ValidateInjectionRequest(request);
        var injection = await GetInjectionForPartnerAsync(partnerId, injectionId);
        EnsureDraft(injection);

        var paymentMethod = NormalizePaymentMethod(request.PaymentMethod);
        var injectedAt = request.InjectedAt ?? DateTime.UtcNow;
        injection.AmountPaisa = request.AmountPaisa;
        injection.InjectedAt = injectedAt;
        injection.LockInMonths = request.LockInMonths;
        injection.LockInExpiresAt = injectedAt.AddMonths(request.LockInMonths);
        injection.PaymentMethod = paymentMethod;
        injection.PaidTo = request.PaidTo!.Trim();
        injection.BankName = request.BankName?.Trim();
        injection.BankAccountNumber = request.BankAccountNumber?.Trim();
        injection.ChequeNumber = request.ChequeNumber?.Trim();
        injection.PaymentReference = request.PaymentReference?.Trim();
        injection.ProofImageUrl = request.ProofImageUrl?.Trim();
        injection.Note = request.Note?.Trim();
        injection.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "CapitalInjectionDraft", injection.Id);
        return ToDto(injection);
    }

    public async Task DeleteInjectionAsync(Guid partnerId, Guid injectionId, Guid userId)
    {
        var injection = await GetInjectionForPartnerAsync(partnerId, injectionId);
        EnsureDraft(injection);
        injection.DeletedAt = DateTime.UtcNow;
        injection.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "DELETE", "CapitalInjectionDraft", injection.Id);
    }

    public async Task<CapitalInjectionDto> SubmitInjectionForApprovalAsync(Guid partnerId, Guid injectionId, Guid userId)
    {
        var injection = await GetInjectionForPartnerAsync(partnerId, injectionId);
        EnsureDraft(injection);
        injection.Status = "PENDING_APPROVAL";
        injection.SubmittedAt = DateTime.UtcNow;
        injection.SubmittedBy = userId;
        injection.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "SUBMIT", "CapitalInjection", injection.Id);
        return ToDto(injection);
    }

    public async Task<CapitalInjectionApprovalStatusDto> GetInjectionApprovalStatusAsync(Guid partnerId, Guid injectionId)
    {
        var injection = await GetInjectionForPartnerAsync(partnerId, injectionId);
        return await BuildApprovalStatusAsync(injection);
    }

    public async Task<CapitalInjectionApprovalStatusDto> CastInjectionApprovalVoteAsync(Guid partnerId, Guid injectionId, CastCapitalInjectionApprovalVoteRequest request, Guid userId)
    {
        var injection = await GetInjectionForPartnerAsync(partnerId, injectionId);
        if (injection.Status != "PENDING_APPROVAL")
            throw new InvalidOperationException("Only submitted capital injections can be approved or rejected.");

        var decision = request.Decision.Trim().ToUpperInvariant();
        if (!ValidApprovalDecisions.Contains(decision))
            throw new ArgumentException("Decision must be APPROVE or REJECT.");
        if (decision == "REJECT" && string.IsNullOrWhiteSpace(request.Note))
            throw new ArgumentException("Rejection reason is required.");

        var voter = await _db.Partners.FirstOrDefaultAsync(p =>
                p.LinkedUserId == userId && p.PartnerType == "MANAGING" && p.Status == "ACTIVE")
            ?? throw new UnauthorizedAccessException("Your login account is not linked to an active managing partner.");

        var existingVote = await _db.CapitalInjectionApprovalVotes.AsNoTracking()
            .FirstOrDefaultAsync(v => v.CapitalInjectionId == injectionId && v.VotedByPartnerId == voter.Id);
        if (existingVote != null)
        {
            if (existingVote.Decision == decision)
                return await BuildApprovalStatusAsync(injection);
            throw new InvalidOperationException("This managing partner has already recorded a different decision on this capital injection.");
        }

        await using var transaction = await _db.Database.BeginTransactionAsync();
        _db.CapitalInjectionApprovalVotes.Add(new CapitalInjectionApprovalVote
        {
            BusinessId = _business.CurrentBusinessId,
            CapitalInjectionId = injectionId,
            VotedByPartnerId = voter.Id,
            Decision = decision,
            Note = request.Note?.Trim(),
            VotedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var status = await BuildApprovalStatusAsync(injection);
        var outcome = PartnerService.ComputeOutcome(status.ApproveCount, status.RejectCount, status.RequiredVotes, status.ActiveManagingPartnerCount);
        if (outcome == "ACTIVE")
            await ApproveInjectionAsync(injection, userId);
        else if (outcome == "REJECTED")
            await RejectInjectionAsync(injection, userId, request.Note);

        var result = await BuildApprovalStatusAsync(injection);
        await transaction.CommitAsync();
        return result;
    }

    private async Task ApproveInjectionAsync(CapitalInjection injection, Guid userId)
    {
        var ledgerAlreadyExists = await _db.CapitalLedgerEntries.AnyAsync(entry =>
            entry.ReferenceType == "CapitalInjection" && entry.ReferenceId == injection.Id);
        if (!ledgerAlreadyExists)
        {
            var currentCapitalBalance = await SumBucketAsync(injection.PartnerId, "CAPITAL");
            _db.CapitalLedgerEntries.Add(new CapitalLedgerEntry
            {
                BusinessId = _business.CurrentBusinessId,
                PartnerId = injection.PartnerId,
                EntryType = "CAPITAL_INJECTION",
                Bucket = "CAPITAL",
                AmountPaisa = injection.AmountPaisa,
                BalanceAfterPaisa = ComputeBalanceAfter(currentCapitalBalance, injection.AmountPaisa),
                ReferenceType = "CapitalInjection",
                ReferenceId = injection.Id,
                Note = BuildLedgerNote(injection.PaymentMethod, injection.PaidTo, injection.PaymentReference, injection.Note),
                CreatedBy = userId
            });
        }

        injection.Status = "APPROVED";
        injection.ApprovedAt = DateTime.UtcNow;
        injection.ApprovedBy = userId;
        injection.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "CapitalInjection", injection.Id);
    }

    private async Task RejectInjectionAsync(CapitalInjection injection, Guid userId, string? reason)
    {
        injection.Status = "REJECTED";
        injection.RejectedAt = DateTime.UtcNow;
        injection.RejectedBy = userId;
        injection.RejectionReason = reason?.Trim();
        injection.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "REJECT", "CapitalInjection", injection.Id);
    }

    public async Task<List<CapitalInjectionDto>> ListInjectionsAsync(Guid partnerId)
    {
        return await _db.CapitalInjections.AsNoTracking()
            .Where(i => i.PartnerId == partnerId)
            .OrderByDescending(i => i.InjectedAt)
            .Select(i => new CapitalInjectionDto(
                i.Id, i.PartnerId, i.AmountPaisa, i.InjectedAt, i.LockInMonths, i.LockInExpiresAt,
                i.PaymentMethod, i.PaidTo, i.BankName, i.BankAccountNumber, i.ChequeNumber,
                i.PaymentReference, i.ProofImageUrl, i.Note, i.Status, i.SubmittedAt, i.ApprovedAt,
                i.RejectedAt, i.RejectionReason))
            .ToListAsync();
    }

    public async Task<List<CapitalInjectionDto>> ListPendingInjectionsAsync()
    {
        return await _db.CapitalInjections.AsNoTracking()
            .Where(i => i.Status == "PENDING_APPROVAL")
            .OrderByDescending(i => i.SubmittedAt)
            .Select(i => new CapitalInjectionDto(
                i.Id, i.PartnerId, i.AmountPaisa, i.InjectedAt, i.LockInMonths, i.LockInExpiresAt,
                i.PaymentMethod, i.PaidTo, i.BankName, i.BankAccountNumber, i.ChequeNumber,
                i.PaymentReference, i.ProofImageUrl, i.Note, i.Status, i.SubmittedAt, i.ApprovedAt,
                i.RejectedAt, i.RejectionReason))
            .ToListAsync();
    }

    public async Task<List<CapitalLedgerEntryDto>> ListLedgerAsync(Guid partnerId, DateTime? from, DateTime? to)
    {
        var q = _db.CapitalLedgerEntries.AsNoTracking().Where(l => l.PartnerId == partnerId);
        if (from.HasValue) q = q.Where(l => l.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(l => l.CreatedAt <= to.Value);

        return await q.OrderByDescending(l => l.CreatedAt)
            .Select(l => new CapitalLedgerEntryDto(
                l.Id, l.PartnerId, l.EntryType, l.Bucket, l.AmountPaisa, l.BalanceAfterPaisa,
                l.ReferenceType, l.ReferenceId, l.Note, l.CreatedAt))
            .ToListAsync();
    }

    public async Task<PartnerBalanceDto> GetBalanceAsync(Guid partnerId)
    {
        var partner = await _db.Partners.AsNoTracking().FirstOrDefaultAsync(p => p.Id == partnerId)
            ?? throw new KeyNotFoundException("Partner not found.");

        var capital = await SumBucketAsync(partnerId, "CAPITAL");
        var profit = await SumBucketAsync(partnerId, "PROFIT");
        return new PartnerBalanceDto(capital, profit, partner.DeferredLossPaisa);
    }

    private async Task<long> SumBucketAsync(Guid partnerId, string bucket)
    {
        return await _db.CapitalLedgerEntries.AsNoTracking()
            .Where(l => l.PartnerId == partnerId && l.Bucket == bucket)
            .SumAsync(l => (long?)l.AmountPaisa) ?? 0L;
    }

    private static CapitalInjectionDto ToDto(CapitalInjection i) =>
        new(
            i.Id, i.PartnerId, i.AmountPaisa, i.InjectedAt, i.LockInMonths, i.LockInExpiresAt,
            i.PaymentMethod, i.PaidTo, i.BankName, i.BankAccountNumber, i.ChequeNumber,
            i.PaymentReference, i.ProofImageUrl, i.Note, i.Status, i.SubmittedAt, i.ApprovedAt,
            i.RejectedAt, i.RejectionReason);

    private CapitalInjection BuildInjection(Guid partnerId, CreateCapitalInjectionRequest request, Guid userId)
    {
        var paymentMethod = NormalizePaymentMethod(request.PaymentMethod);
        var injectedAt = request.InjectedAt ?? DateTime.UtcNow;
        return new CapitalInjection
        {
            BusinessId = _business.CurrentBusinessId,
            PartnerId = partnerId,
            AmountPaisa = request.AmountPaisa,
            InjectedAt = injectedAt,
            LockInMonths = request.LockInMonths,
            LockInExpiresAt = injectedAt.AddMonths(request.LockInMonths),
            PaymentMethod = paymentMethod,
            PaidTo = request.PaidTo!.Trim(),
            BankName = request.BankName?.Trim(),
            BankAccountNumber = request.BankAccountNumber?.Trim(),
            ChequeNumber = request.ChequeNumber?.Trim(),
            PaymentReference = request.PaymentReference?.Trim(),
            ProofImageUrl = request.ProofImageUrl?.Trim(),
            Note = request.Note?.Trim(),
            Status = "DRAFT",
            CreatedBy = userId
        };
    }

    private static void ValidateInjectionRequest(CreateCapitalInjectionRequest request)
    {
        if (request.AmountPaisa <= 0)
            throw new ArgumentException("Injection amount must be greater than zero.");
        if (request.LockInMonths < 0)
            throw new ArgumentException("Lock-in months cannot be negative.");
        var paymentMethod = NormalizePaymentMethod(request.PaymentMethod);
        if (string.IsNullOrWhiteSpace(request.PaidTo))
            throw new ArgumentException("Paid to is required.");
        if (paymentMethod == "BANK" && (string.IsNullOrWhiteSpace(request.BankName) || string.IsNullOrWhiteSpace(request.BankAccountNumber)))
            throw new ArgumentException("Bank name and account number are required for bank payments.");
        if (paymentMethod == "CHEQUE" && string.IsNullOrWhiteSpace(request.ChequeNumber))
            throw new ArgumentException("Cheque number is required for cheque payments.");
    }

    private async Task<CapitalInjection> GetInjectionForPartnerAsync(Guid partnerId, Guid injectionId) =>
        await _db.CapitalInjections.FirstOrDefaultAsync(i => i.Id == injectionId && i.PartnerId == partnerId)
            ?? throw new KeyNotFoundException("Capital injection not found.");

    private static void EnsureDraft(CapitalInjection injection)
    {
        if (injection.Status != "DRAFT")
            throw new InvalidOperationException("Only draft capital injections can be edited or deleted.");
    }

    private async Task<CapitalInjectionApprovalStatusDto> BuildApprovalStatusAsync(CapitalInjection injection)
    {
        var activeManagingPartnerCount = await _db.Partners.AsNoTracking()
            .CountAsync(p => p.PartnerType == "MANAGING" && p.Status == "ACTIVE");
        var votes = await _db.CapitalInjectionApprovalVotes.AsNoTracking()
            .Where(v => v.CapitalInjectionId == injection.Id)
            .Join(_db.Partners.AsNoTracking(), v => v.VotedByPartnerId, p => p.Id, (v, p) => new { Vote = v, PartnerName = p.Name })
            .OrderBy(x => x.Vote.VotedAt)
            .Select(x => new CapitalInjectionApprovalVoteDto(
                x.Vote.Id, x.Vote.CapitalInjectionId, x.Vote.VotedByPartnerId, x.PartnerName,
                x.Vote.Decision, x.Vote.Note, x.Vote.VotedAt))
            .ToListAsync();
        return new CapitalInjectionApprovalStatusDto(
            injection.Id,
            injection.Status,
            votes.Count(v => v.Decision == "APPROVE"),
            votes.Count(v => v.Decision == "REJECT"),
            PartnerService.ComputeApprovalThreshold(activeManagingPartnerCount),
            activeManagingPartnerCount,
            votes);
    }

    private static string NormalizePaymentMethod(string? paymentMethod)
    {
        var normalized = string.IsNullOrWhiteSpace(paymentMethod) ? "CASH" : paymentMethod.Trim().ToUpperInvariant();
        if (!ValidPaymentMethods.Contains(normalized))
            throw new ArgumentException("Payment method must be CASH, BANK, CHEQUE, or MOBILE_BANKING.");
        return normalized;
    }

    private static string? BuildLedgerNote(string paymentMethod, string paidTo, string? reference, string? note)
    {
        var parts = new List<string> { $"Paid by {paymentMethod}", $"Paid to {paidTo.Trim()}" };
        if (!string.IsNullOrWhiteSpace(reference)) parts.Add($"Ref: {reference.Trim()}");
        if (!string.IsNullOrWhiteSpace(note)) parts.Add(note.Trim());
        return string.Join(" | ", parts);
    }

    /// <summary>
    /// All ledger arithmetic is integer paisa (R15.2/R7) — no decimal/float anywhere, so this is
    /// exact for any sequence of credits/debits. Exposed as a pure static method so it's directly
    /// unit-testable without a DbContext, matching the PurchaseTripService.ComputeLandedCost pattern.
    /// </summary>
    public static long ComputeBalanceAfter(long currentBalancePaisa, long signedAmountPaisa) =>
        currentBalancePaisa + signedAmountPaisa;
}
