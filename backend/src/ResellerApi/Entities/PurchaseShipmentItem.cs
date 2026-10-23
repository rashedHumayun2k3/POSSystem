using ResellerApi.Entities.Base;
namespace ResellerApi.Entities;
public class PurchaseShipmentItem : BaseEntity
{
    public Guid ShipmentId { get; set; }
    public Guid PurchaseItemId { get; set; }
    public decimal Qty { get; set; }
    public PurchaseShipment Shipment { get; set; } = null!;
    public PurchaseItem PurchaseItem { get; set; } = null!;
}
