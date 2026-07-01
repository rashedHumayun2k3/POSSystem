using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PriceSlot : BusinessScopedEntity
{
    public Guid VariantId { get; set; }
    public string Label { get; set; } = null!;
    public decimal Price { get; set; }
    public string? Reason { get; set; }
    public bool IsActive { get; set; } = false;
    public Guid CreatedBy { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public ICollection<PriceActivationLog> ActivationLogs { get; set; } = [];
}
