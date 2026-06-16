using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

/// <summary>
/// Immutable, append-only financial event for a partner (R15.3). NO service in this codebase
/// exposes an Update or Delete for this entity — that is the (application-layer) enforcement
/// mechanism for this sub-phase. A dedicated SQL login with DENY UPDATE/DELETE is the
/// pre-production hardening step, tracked in Module 15 of the requirements doc.
/// </summary>
public class CapitalLedgerEntry : BusinessScopedEntity
{
    public Guid PartnerId { get; set; }

    // CAPITAL_INJECTION | CORRECTION are used by this sub-phase (15a).
    // PROFIT_CREDIT | LOSS_DEBIT | LOSS_RECOVERY | DISTRIBUTION | WITHDRAWAL | EXIT_SETTLEMENT
    // are reserved for sub-phases 15b–15d so the schema doesn't need another migration when they land.
    public string EntryType { get; set; } = null!;

    public string Bucket { get; set; } = null!; // CAPITAL | PROFIT (R15.4)

    public long AmountPaisa { get; set; }       // signed: positive = credit, negative = debit
    public long BalanceAfterPaisa { get; set; } // snapshot of this bucket's running balance, for fast display only

    public string? ReferenceType { get; set; }  // e.g. "CapitalInjection"
    public Guid? ReferenceId { get; set; }
    public string? Note { get; set; }
    public Guid CreatedBy { get; set; }

    public Partner Partner { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}
