using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PriceHistory : BusinessScopedEntity
{
    public Guid VariantId { get; set; }
    public decimal OldPrice { get; set; }
    public decimal NewPrice { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public Guid ChangedBy { get; set; }
    public string Reason { get; set; } = null!;
    public bool IsScheduled { get; set; } = false;   // future-dated change
    public bool IsRevert { get; set; } = false;       // auto-revert row
    public bool IsApplied { get; set; } = false;      // Hangfire job has applied this scheduled change

    public ProductVariant Variant { get; set; } = null!;
    public User ChangedByUser { get; set; } = null!;
}
