using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// Partner withdrawal (Module 15d table). No approval step by Owner decision: saved as APPROVED
// and posted to capital_ledger in the same transaction. Takes money out of the shop cash.
public class WithdrawalRequest : BusinessScopedEntity
{
    public Guid PartnerId { get; set; }
    public string Type { get; set; } = null!;          // CAPITAL | PROFIT
    public string Source { get; set; } = "CASH";      // CASH | BKASH | NAGAD | CARD: wallet the money left
    public long AmountPaisa { get; set; }
    public long AvailableSnapshotPaisa { get; set; }   // withdrawable balance at request time
    public string Status { get; set; } = "APPROVED";   // APPROVED (approval flow not used)
    public DateTime RequestedAt { get; set; }
    public Guid RequestedBy { get; set; }
    public string? Note { get; set; }
    public Guid RequestId { get; set; }                // client idempotency key
}
