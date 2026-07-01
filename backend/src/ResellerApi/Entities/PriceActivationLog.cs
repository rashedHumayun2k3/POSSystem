using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PriceActivationLog : BusinessScopedEntity
{
    public Guid VariantId { get; set; }
    public Guid SlotId { get; set; }
    public decimal PriceSnapshot { get; set; }
    public string LabelSnapshot { get; set; } = null!;
    public DateTime ActivatedAt { get; set; }
    public DateTime? DeactivatedAt { get; set; }
    public Guid ActivatedBy { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public PriceSlot Slot { get; set; } = null!;
    public User ActivatedByUser { get; set; } = null!;
}
