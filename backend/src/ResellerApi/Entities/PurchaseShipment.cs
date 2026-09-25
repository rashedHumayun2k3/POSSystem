using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PurchaseShipment : BaseEntity
{
    public Guid TripId { get; set; }
    public Guid ShippingCompanyId { get; set; }
    public Guid? ShippingCompanyRateId { get; set; }
    public Guid PurchaseTripCostId { get; set; }
    public string ShippingCompanyNameSnapshot { get; set; } = null!;
    public string ShippingMethod { get; set; } = null!;
    public string ChargeBasis { get; set; } = "PER_KG";
    public decimal RateAmountSnapshot { get; set; }
    public string CurrencyCode { get; set; } = "BDT";
    public decimal BillableQuantity { get; set; }
    public decimal CalculatedCost { get; set; }
    public string? TrackingNumber { get; set; }
    public string? Note { get; set; }

    public PurchaseTrip Trip { get; set; } = null!;
    public ShippingCompany ShippingCompany { get; set; } = null!;
    public ShippingCompanyRate? ShippingCompanyRate { get; set; }
    public PurchaseTripCost PurchaseTripCost { get; set; } = null!;
}
