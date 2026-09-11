using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class OrderItem : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public Guid VariantId { get; set; }
    public ProductVariant Variant { get; set; } = null!;

    public decimal Qty { get; set; }
    public decimal UnitPrice { get; set; }

    // Snapshots frozen at confirm (GTR-8) — owner-only in responses
    public decimal? UnitCostSnapshot { get; set; }
    public decimal? OverheadRateSnapshot { get; set; }
    public decimal? MarketingRateSnapshot { get; set; }

    public bool IsDamagedItem { get; set; }

    public Guid? LotId { get; set; }
    public Lot? Lot { get; set; }
}
