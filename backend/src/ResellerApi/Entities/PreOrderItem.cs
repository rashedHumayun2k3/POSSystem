using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PreOrderItem : BusinessScopedEntity
{
    public Guid PreOrderId { get; set; }
    public string ProductName { get; set; } = null!;
    public decimal? QuantityRequested { get; set; }
    public PreOrder PreOrder { get; set; } = null!;
}
