using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Lot : BusinessScopedEntity, IBranchScoped
{
    public Guid? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public Guid VariantId { get; set; }
    public Guid PurchaseItemId { get; set; }
    public decimal QtyIn { get; set; }
    public decimal LandedUnitCost { get; set; }
    public string PerLotValuesJson { get; set; } = "{}";
    public decimal RemainingQty { get; set; }

    // Short human-writable code (e.g. "A1") printed on hawker stickers/stubs; null for non-hawker lots.
    public string? DisplayCode { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public PurchaseItem PurchaseItem { get; set; } = null!;
}
