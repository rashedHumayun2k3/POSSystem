using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PurchaseTrip : BusinessScopedEntity, IBranchScoped
{
    public Guid? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public string TripNo { get; set; } = null!;
    public string SourceType { get; set; } = null!;
    public string Status { get; set; } = "DRAFT";   // DRAFT | PENDING_APPROVAL | RECEIVING | COMPLETED | CANCELLED
    public string? Note { get; set; }
    public DateTime? ExpectedDeliveryDate { get; set; }
    public string? SupplierPoRef { get; set; }
    public Guid CreatedBy { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? ForceCompleteReason { get; set; }

    public User CreatedByUser { get; set; } = null!;
    public ICollection<PurchaseItem> Items { get; set; } = new List<PurchaseItem>();
    public ICollection<PurchaseTripCost> Costs { get; set; } = new List<PurchaseTripCost>();
    public ICollection<PurchaseReceiveSession> Sessions { get; set; } = new List<PurchaseReceiveSession>();
}
