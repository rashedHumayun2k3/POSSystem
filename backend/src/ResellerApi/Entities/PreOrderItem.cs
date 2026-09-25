using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PreOrderItem : BusinessScopedEntity
{
    public Guid PreOrderId { get; set; }
    public Guid ProductId { get; set; }
    public Guid VariantId { get; set; }
    public decimal QuantityRequested { get; set; }
    public decimal QuantityReserved { get; set; }
    public decimal QuantityFulfilled { get; set; }
    public decimal UnitPriceSnapshot { get; set; }
    public string ProductNameSnapshot { get; set; } = null!;
    public string VariantNameSnapshot { get; set; } = null!;
    public PreOrder PreOrder { get; set; } = null!;
    public Product Product { get; set; } = null!;
    public ProductVariant Variant { get; set; } = null!;
}
