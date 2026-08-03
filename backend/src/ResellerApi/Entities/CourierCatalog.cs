using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// Global template catalog — NOT business-scoped, managed by the platform admin. Picking one
// COPIES its values into a new real (business-scoped) Courier row; a business's rates are then
// theirs alone to edit. CourierCatalogId on Courier is kept purely so the admin can tell whether
// a catalog entry is currently in use before allowing it to be edited/removed.
public class CourierCatalog : BaseEntity
{
    public string Name { get; set; } = null!;
    public decimal InsideDhakaCharge { get; set; } = 0;
    public decimal OutsideDhakaCharge { get; set; } = 0;
    public decimal ReturnCharge { get; set; } = 0;
    public string CodFeeType { get; set; } = "PCT"; // FLAT | PCT
    public decimal CodFeeValue { get; set; } = 0;
    public string? TrackingUrlTemplate { get; set; }
    public bool IsActive { get; set; } = true;
}
