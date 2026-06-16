using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Partners;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PartnerCapitalService : IPartnerCapitalService
{
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
        if (request.AmountPaisa <= 0)
            throw new ArgumentException("Injection amount must be greater than zero.");
        if (request.LockInMonths < 0)
            throw new ArgumentException("Lock-in months cannot be negative.");

        var partner = await _db.Partners.FirstOrDefaultAsync(p => p.Id == partnerId)
            ?? throw new KeyNotFoundException("Partner not found.");

        var injectedAt = request.InjectedAt ?? DateTime.UtcNow;
        var injection = new CapitalInjection
        {
            BusinessId = _business.CurrentBusinessId,
            PartnerId = partnerId,
            AmountPaisa = request.AmountPaisa,
            InjectedAt = injectedAt,
            LockInMonths = request.LockInMonths,
            LockInExpiresAt = injectedAt.AddMonths(request.LockInMonths),
            Note = request.Note?.Trim(),
            CreatedBy = userId
        };

        // NOTE (15a, foundation scope): this is an Owner-only, manually-triggered, low-frequency
        // action — read-then-write of the running balance is not row-locked. If/when this needs to
        // tolerate concurrent injections for the same partner, wrap in BeginTransactionAsync with
        // an explicit lock the way stock mutations do (requirements Part 4.6 UPDLOCK pattern).
        var currentCapitalBalance = await SumBucketAsync(partnerId, "CAPITAL");
        var ledgerEntry = new CapitalLedgerEntry
        {
            BusinessId = _business.CurrentBusinessId,
            PartnerId = partnerId,
            EntryType = "CAPITAL_INJECTION",
            Bucket = "CAPITAL",
            AmountPaisa = request.AmountPaisa,
            BalanceAfterPaisa = ComputeBalanceAfter(currentCapitalBalance, request.AmountPaisa),
            ReferenceType = "CapitalInjection",
            ReferenceId = injection.Id,
            Note = request.Note?.Trim(),
            CreatedBy = userId
        };

        _db.CapitalInjections.Add(injection);
        _db.CapitalLedgerEntries.Add(ledgerEntry);
        await _db.SaveChangesAsync();

        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "CapitalInjection", injection.Id);

        return ToDto(injection);
    }

    public async Task<List<CapitalInjectionDto>> ListInjectionsAsync(Guid partnerId)
    {
        return await _db.CapitalInjections.AsNoTracking()
            .Where(i => i.PartnerId == partnerId)
            .OrderByDescending(i => i.InjectedAt)
            .Select(i => new CapitalInjectionDto(i.Id, i.PartnerId, i.AmountPaisa, i.InjectedAt, i.LockInMonths, i.LockInExpiresAt, i.Note))
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
        new(i.Id, i.PartnerId, i.AmountPaisa, i.InjectedAt, i.LockInMonths, i.LockInExpiresAt, i.Note);

    /// <summary>
    /// All ledger arithmetic is integer paisa (R15.2/R7) — no decimal/float anywhere, so this is
    /// exact for any sequence of credits/debits. Exposed as a pure static method so it's directly
    /// unit-testable without a DbContext, matching the PurchaseTripService.ComputeLandedCost pattern.
    /// </summary>
    public static long ComputeBalanceAfter(long currentBalancePaisa, long signedAmountPaisa) =>
        currentBalancePaisa + signedAmountPaisa;
}
