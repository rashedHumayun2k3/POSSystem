using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class SupplierReturn : BusinessScopedEntity, IBranchScoped
{
    public Guid? BranchId { get; set; }
    public Branch? Branch { get; set; }

    public string SupplierReturnNo { get; set; } = null!;
    public Guid SupplierId { get; set; }
    public Supplier Supplier { get; set; } = null!;

    // Optional — the trip the damaged goods originally arrived on. Not required because a
    // return can bundle damaged units from multiple trips with the same supplier.
    public Guid? TripId { get; set; }
    public PurchaseTrip? Trip { get; set; }

    public string Status { get; set; } = "DRAFT"; // DRAFT | SUBMITTED | RESOLVED | CANCELLED
    public string? Note { get; set; }

    public Guid CreatedBy { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public DateTime? ResolvedAt { get; set; }
    public Guid? ResolvedBy { get; set; }
    public User? ResolvedByUser { get; set; }

    public ICollection<SupplierReturnItem> Items { get; set; } = new List<SupplierReturnItem>();
}
