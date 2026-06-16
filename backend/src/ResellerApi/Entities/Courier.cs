using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Courier : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string? Phone { get; set; }
    public decimal InsideDhakaCharge { get; set; } = 0;
    public decimal OutsideDhakaCharge { get; set; } = 0;
    public decimal ReturnCharge { get; set; } = 0;
    public string CodFeeType { get; set; } = "PCT"; // FLAT | PCT
    public decimal CodFeeValue { get; set; } = 0;
    public bool IsDefault { get; set; } = false;
    public string? TrackingUrlTemplate { get; set; }
    public bool IsActive { get; set; } = true;
}
