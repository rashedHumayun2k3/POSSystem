using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class CpCheckoutGroupOrder : BaseEntity
{
    public Guid CheckoutGroupId { get; set; }
    public Guid OrderId { get; set; }
    public Guid BusinessId { get; set; } // denormalized, for display only

    public CpCheckoutGroup CheckoutGroup { get; set; } = null!;
    public Order Order { get; set; } = null!;
}
