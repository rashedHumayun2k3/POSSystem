using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Courier : BusinessScopedEntity
{
    // Which catalog entry this was created from (if picked from the platform's courier catalog,
    // as opposed to a legacy free-form entry) — used only to check "is this catalog entry in use"
    // before the platform admin edits/removes it. Values on this row are an independent copy.
    public Guid? CourierCatalogId { get; set; }
    public CourierCatalog? CourierCatalog { get; set; }

    public string Name { get; set; } = null!;
    public string? Phone { get; set; }
    public decimal InsideDhakaCharge { get; set; } = 0;
    public decimal OutsideDhakaCharge { get; set; } = 0;
    public decimal ReturnCharge { get; set; } = 0;
    public string CodFeeType { get; set; } = "PCT"; // FLAT | PCT
    public decimal CodFeeValue { get; set; } = 0;
    public bool IsDefault { get; set; } = false;
    public string? TrackingUrlTemplate { get; set; }
    public string? Contact { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<DeliveryMan> DeliveryMen { get; set; } = new List<DeliveryMan>();
}
