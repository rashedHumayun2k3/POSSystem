namespace ResellerApi.Entities;

public class VariantInventory
{
    public Guid VariantId { get; set; }
    public decimal OnHand { get; set; }
    public decimal Committed { get; set; }
    public decimal Damaged { get; set; }

    public ProductVariant Variant { get; set; } = null!;

    // Computed — not stored
    public decimal Available => OnHand - Committed - Damaged;
}
