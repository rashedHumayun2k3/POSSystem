using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class SubscriptionPayment : BaseEntity
{
    public Guid SubscriptionId { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = "BKASH";
    public string Status { get; set; } = "PENDING"; // PENDING | SUCCESS | FAILED
    public string GatewayPaymentId { get; set; } = null!; // bKash paymentID, assigned at checkout creation
    public string? GatewayTrxId { get; set; }             // bKash trxID, set once execute succeeds
    public DateTime? PaidAt { get; set; }

    public Subscription Subscription { get; set; } = null!;
}
