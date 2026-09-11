using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Partner : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string? Phone { get; set; }
    public string? PhotoUrl { get; set; }
    public Guid? LinkedUserId { get; set; }
    public string PartnerType { get; set; } = null!; // MANAGING | SLEEPING — immutable once a ledger entry exists (R15.1)
    public string Status { get; set; } = "PENDING_APPROVAL"; // PENDING_APPROVAL | ACTIVE | REJECTED | EXITED (R15.11)
    public long DeferredLossPaisa { get; set; }        // unabsorbed loss carried forward (R15.4)
    public DateTime? JoinDate { get; set; }
    public string? Note { get; set; }

    // R15.11 — additional partner profile fields, captured at add-partner time.
    public string? NidNumber { get; set; }
    public string? Address { get; set; }
    public string? Email { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankName { get; set; }
    public decimal? AgreedProfitSharePct { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public string? EmergencyContactRelation { get; set; }

    public ICollection<CapitalInjection> CapitalInjections { get; set; } = new List<CapitalInjection>();
    public ICollection<CapitalLedgerEntry> LedgerEntries { get; set; } = new List<CapitalLedgerEntry>();
    public ICollection<PartnerApprovalVote> ApprovalVotes { get; set; } = new List<PartnerApprovalVote>();
    public User? LinkedUser { get; set; }
}
