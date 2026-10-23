using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PurchaseShipment : BaseEntity
{
    public string LotNo { get; set; } = "";
    public string Status { get; set; } = "READY";
    public bool IsLegacy { get; set; }
    public DateTime? ShippedDate { get; set; }
    public decimal DeclaredWeightGrams { get; set; }
    public decimal MeasuredWeightGrams { get; set; }
    public decimal BilledWeightGrams { get; set; }
    public ICollection<PurchaseShipmentItem> Items { get; set; } = new List<PurchaseShipmentItem>();
    public Guid TripId { get; set; }
    public Guid? ShippingCompanyId { get; set; }
    public Guid? ShippingCompanyRateId { get; set; }
    public Guid? PurchaseTripCostId { get; set; }
    public string ShippingCompanyNameSnapshot { get; set; } = "";
    public string ShippingMethod { get; set; } = "";
    public string ChargeBasis { get; set; } = "PER_KG";
    public decimal RateAmountSnapshot { get; set; }
    public string CurrencyCode { get; set; } = "BDT";
    public decimal BillableQuantity { get; set; }
    public decimal CalculatedCost { get; set; }
    public string? TrackingNumber { get; set; }
    public string? Note { get; set; }

    public PurchaseTrip Trip { get; set; } = null!;
    public ShippingCompany? ShippingCompany { get; set; }
    public ShippingCompanyRate? ShippingCompanyRate { get; set; }
    public PurchaseTripCost? PurchaseTripCost { get; set; }
}
