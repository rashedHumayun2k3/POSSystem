using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public record CreateWithdrawalRequest(Guid PartnerId, string Source, long AmountPaisa, Guid RequestId, string? Note = null);
public record WithdrawalDto(Guid Id, Guid PartnerId, string PartnerName, string Source, long AmountPaisa, string? Note, DateTime RequestedAt);
public record WithdrawalPartner(Guid Id, string Name);
public record WithdrawalForm(Dictionary<string, long> WalletPaisa, List<WithdrawalPartner> Partners);

// Partner withdrawal (Owner decision): no approval, no lock-in/profit limit.
// The only limit is the selected wallet's balance. Posted to the partner's CAPITAL ledger.
public sealed class PartnerWithdrawalService(AppDbContext db, IBusinessContext business, IActivityLogService log)
{
    public static readonly string[] Wallets = ["CASH", "BKASH", "NAGAD", "CARD"];

    // Wallet balances for the whole business, same rule as the Cash Book. Null when not on SQL Server (tests).
    public async Task<Dictionary<string, long>?> WalletPaisaAsync()
    {
        if (!db.Database.IsSqlServer()) return null;
        var rows = await db.Database.SqlQuery<WalletRow>($@"SELECT Source, COALESCE(SUM(Amount),0) AS Amount
            FROM dbo.CashFlowMovements({business.CurrentBusinessId}, NULL, {DateTime.UtcNow}) GROUP BY Source").ToListAsync();
        return Wallets.ToDictionary(w => w, w => (long)Math.Round((rows.FirstOrDefault(r => r.Source == w)?.Amount ?? 0) * 100));
    }
    private sealed record WalletRow(string Source, decimal Amount);

    // Only the logged-in user's own partner record — a user can't move money for another partner.
    public async Task<WithdrawalForm> FormAsync(Guid userId)
    {
        var partners = await db.Partners.AsNoTracking().Where(p => p.Status == "ACTIVE" && p.LinkedUserId == userId).OrderBy(p => p.Name)
            .Select(p => new WithdrawalPartner(p.Id, p.Name)).ToListAsync();
        return new(await WalletPaisaAsync() ?? Wallets.ToDictionary(w => w, _ => 0L), partners);
    }

    public async Task<List<WithdrawalDto>> ListAsync(int limit = 30) => await db.WithdrawalRequests.AsNoTracking()
        .OrderByDescending(w => w.RequestedAt).Take(Math.Clamp(limit, 1, 100))
        .Join(db.Partners.IgnoreQueryFilters(), w => w.PartnerId, p => p.Id,
            (w, p) => new WithdrawalDto(w.Id, w.PartnerId, p.Name, w.Source, w.AmountPaisa, w.Note, w.RequestedAt))
        .ToListAsync();

    public async Task<WithdrawalDto> WithdrawAsync(CreateWithdrawalRequest req, Guid userId)
    {
        var source = req.Source?.Trim().ToUpperInvariant() ?? "";
        if (!Wallets.Contains(source)) throw new ArgumentException("Choose Cash, bKash, Nagad or Card.");
        if (req.AmountPaisa <= 0) throw new ArgumentException("Amount must be greater than zero.");
        if (req.RequestId == Guid.Empty) throw new ArgumentException("A request ID is required.");
        var note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();
        if (note?.Length > 300) throw new ArgumentException("Note must be 300 characters or fewer.");

        var funding = new ExpenseFundingService(db, business);
        await using var tx = await funding.BeginAsync();
        var previous = await db.WithdrawalRequests.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(w => w.BusinessId == business.CurrentBusinessId && w.RequestId == req.RequestId);
        if (previous != null)
        {
            if (previous.RequestedBy == userId && previous.PartnerId == req.PartnerId && previous.Source == source && previous.AmountPaisa == req.AmountPaisa)
                return (await ListAsync(100)).First(w => w.Id == previous.Id);
            throw new InvalidOperationException("This save request has already been used. Start a new withdrawal.");
        }
        var partner = await db.Partners.AsNoTracking().FirstOrDefaultAsync(p => p.Id == req.PartnerId && p.Status == "ACTIVE")
            ?? throw new KeyNotFoundException("Partner not found.");
        if (partner.LinkedUserId != userId) throw new InvalidOperationException("You can only withdraw for your own partner account.");
        await funding.EnsureDateOpenAsync(DateTime.UtcNow);

        var wallets = await WalletPaisaAsync();
        var available = wallets?[source] ?? req.AmountPaisa;
        if (req.AmountPaisa > available)
            throw new InvalidOperationException($"Only ৳{Math.Max(0, available) / 100m:N2} is in {Label(source)}.");

        var now = DateTime.UtcNow;
        var withdrawal = new WithdrawalRequest
        {
            BusinessId = business.CurrentBusinessId, PartnerId = partner.Id, Type = "CAPITAL", Source = source, AmountPaisa = req.AmountPaisa,
            AvailableSnapshotPaisa = available, Status = "APPROVED", RequestedAt = now, RequestedBy = userId, Note = note, RequestId = req.RequestId,
        };
        db.WithdrawalRequests.Add(withdrawal);
        var capital = await db.CapitalLedgerEntries.Where(l => l.PartnerId == partner.Id && l.Bucket == "CAPITAL").SumAsync(l => (long?)l.AmountPaisa) ?? 0;
        db.CapitalLedgerEntries.Add(new CapitalLedgerEntry
        {
            BusinessId = business.CurrentBusinessId, PartnerId = partner.Id, EntryType = "WITHDRAWAL", Bucket = "CAPITAL",
            AmountPaisa = -req.AmountPaisa, BalanceAfterPaisa = checked(capital - req.AmountPaisa),
            ReferenceType = "WithdrawalRequest", ReferenceId = withdrawal.Id, Note = note ?? $"Withdrawal from {Label(source)}", CreatedBy = userId,
        });
        await db.SaveChangesAsync();
        await log.LogAsync(business.CurrentBusinessId, userId, "CREATE", "WithdrawalRequest", withdrawal.Id, null, new { source, req.AmountPaisa, partner.Name });
        if (tx != null) await tx.CommitAsync();
        return new WithdrawalDto(withdrawal.Id, partner.Id, partner.Name, source, req.AmountPaisa, note, now);
    }

    private static string Label(string source) => source switch { "BKASH" => "bKash", "NAGAD" => "Nagad", "CARD" => "Card", _ => "Cash in hand" };
}
