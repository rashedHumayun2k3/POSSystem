using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PurchaseTripCost : BaseEntity
{
    public Guid TripId { get; set; }
    public string CostType { get; set; } = null!; // TRANSPORT | LABOR | CUSTOMS | SHIPPING_INTL | CURRENCY_LOSS | AGENT_FEE | PAYMENT_FEE | OTHER
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public string? PhotoUrl { get; set; }
    public string? PaidBy { get; set; }
    public bool IsPostCompletion { get; set; }

    public PurchaseTrip Trip { get; set; } = null!;
}
