using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Partner : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string? Phone { get; set; }
    public string PartnerType { get; set; } = null!; // MANAGING | SLEEPING — immutable once a ledger entry exists (R15.1)
    public string Status { get; set; } = "ACTIVE";    // ACTIVE | EXITED
    public long DeferredLossPaisa { get; set; }        // unabsorbed loss carried forward (R15.4)
    public DateTime? JoinDate { get; set; }
    public string? Note { get; set; }

    public ICollection<CapitalInjection> CapitalInjections { get; set; } = new List<CapitalInjection>();
    public ICollection<CapitalLedgerEntry> LedgerEntries { get; set; } = new List<CapitalLedgerEntry>();
}
