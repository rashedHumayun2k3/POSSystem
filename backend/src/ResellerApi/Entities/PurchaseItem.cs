using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PurchaseItem : BaseEntity
{
    public Guid TripId { get; set; }
    public Guid VariantId { get; set; }
    public decimal QtyBought { get; set; }
    public decimal QtyUsable { get; set; }      // cumulative total from all APPROVED sessions
    public decimal QtyDamaged { get; set; }     // cumulative total from all APPROVED sessions
    public decimal TotalCost { get; set; }
    public string? ShopName { get; set; }
    public string? MemoPhotoUrl { get; set; }
    public decimal PaidNow { get; set; }
    public decimal DueAmount { get; set; }
    public DateTime? PromisedDate { get; set; }
    public decimal AllocatedSharedCost { get; set; }
    public decimal LandedUnitCost { get; set; }

    public Guid? SupplierId { get; set; }

    public PurchaseTrip Trip { get; set; } = null!;
    public ProductVariant Variant { get; set; } = null!;
    public Supplier? Supplier { get; set; }
}
