using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PurchaseReceiveItem : BaseEntity
{
    public Guid SessionId { get; set; }
    public Guid PurchaseItemId { get; set; }
    public decimal QtyUsable { get; set; }
    public decimal QtyDamaged { get; set; }
    public string PerLotValuesJson { get; set; } = "{}";

    public PurchaseReceiveSession Session { get; set; } = null!;
    public PurchaseItem PurchaseItem { get; set; } = null!;
}
