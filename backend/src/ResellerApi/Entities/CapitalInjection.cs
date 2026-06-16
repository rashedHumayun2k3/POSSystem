using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

/// <summary>
/// One addition of capital by a partner. Each injection carries its own lock-in period,
/// independent of capital previously invested by the same partner (R15.5).
/// Creating one always creates exactly one <see cref="CapitalLedgerEntry"/> in the same transaction.
/// </summary>
public class CapitalInjection : BusinessScopedEntity
{
    public Guid PartnerId { get; set; }
    public long AmountPaisa { get; set; }
    public DateTime InjectedAt { get; set; }
    public int LockInMonths { get; set; }
    public DateTime LockInExpiresAt { get; set; }
    public string? Note { get; set; }
    public Guid CreatedBy { get; set; }

    public Partner Partner { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}
