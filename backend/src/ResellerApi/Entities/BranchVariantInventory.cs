namespace ResellerApi.Entities;

public class BranchVariantInventory
{
    public Guid BranchId { get; set; }
    public Guid VariantId { get; set; }
    public decimal OnHand { get; set; }
    public decimal Committed { get; set; }
    public decimal Damaged { get; set; }

    public Branch Branch { get; set; } = null!;
    public ProductVariant Variant { get; set; } = null!;

    // Computed — not stored
    public decimal Available => OnHand - Committed - Damaged;
}
