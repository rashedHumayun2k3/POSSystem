using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class DeliveryMan : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public Guid? CourierId { get; set; }
    public Courier? Courier { get; set; }
    public decimal CostPerDelivery { get; set; }
    public bool IsActive { get; set; } = true;
}
