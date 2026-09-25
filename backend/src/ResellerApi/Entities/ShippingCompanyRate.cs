using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ShippingCompanyRate : BaseEntity
{
    public Guid ShippingCompanyId { get; set; }
    public string ShippingMethod { get; set; } = null!;
    public string ChargeBasis { get; set; } = "PER_KG";
    public decimal RateAmount { get; set; }
    public string CurrencyCode { get; set; } = "BDT";
    public decimal? MinimumCharge { get; set; }
    public bool IsActive { get; set; } = true;

    public ShippingCompany ShippingCompany { get; set; } = null!;
}
