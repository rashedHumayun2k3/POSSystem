using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Carton : BusinessScopedEntity, IBranchScoped
{
    public Guid? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public Guid? StorageLocationId { get; set; }
    public StorageLocation? StorageLocation { get; set; }
    public Guid TripId { get; set; }
    public string CartonNo { get; set; } = null!;           // C-01, C-02 …
    public string Status { get; set; } = "SEALED";           // SEALED | OPENED | PARTIAL | DONE
    public string? Location { get; set; }                    // "Shelf A3", "Storeroom B" — free text, kept for old rows
    public string? Notes { get; set; }
    public DateTime? OpenedAt { get; set; }
    public Guid CreatedBy { get; set; }

    public PurchaseTrip Trip { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public ICollection<CartonItem> Items { get; set; } = new List<CartonItem>();
}
