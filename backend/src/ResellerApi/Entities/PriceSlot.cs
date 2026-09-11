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
    // When this slot's price should take effect / stop taking effect. Checked lazily (not via a
    // background job) whenever a product's price is read — see PriceSlotService.EnsureScheduledStateAsync.
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
    public ICollection<PriceActivationLog> ActivationLogs { get; set; } = [];
}
