using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Lot : BusinessScopedEntity
{
    public Guid VariantId { get; set; }
    public Guid PurchaseItemId { get; set; }
    public decimal QtyIn { get; set; }
    public decimal LandedUnitCost { get; set; }
    public string PerLotValuesJson { get; set; } = "{}";
    public decimal RemainingQty { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public PurchaseItem PurchaseItem { get; set; } = null!;
}
