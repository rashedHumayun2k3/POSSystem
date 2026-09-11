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
    public string PaymentMethod { get; set; } = "CASH";
    public string PaidTo { get; set; } = null!;
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? ChequeNumber { get; set; }
    public string? PaymentReference { get; set; }
    public string? ProofImageUrl { get; set; }
    public string? Note { get; set; }
    public string Status { get; set; } = "DRAFT";
    public DateTime? SubmittedAt { get; set; }
    public Guid? SubmittedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? RejectedAt { get; set; }
    public Guid? RejectedBy { get; set; }
    public string? RejectionReason { get; set; }
    public Guid CreatedBy { get; set; }

    public Partner Partner { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public ICollection<CapitalInjectionApprovalVote> ApprovalVotes { get; set; } = new List<CapitalInjectionApprovalVote>();
}
