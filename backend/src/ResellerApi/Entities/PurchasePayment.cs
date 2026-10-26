using ResellerApi.Entities.Base;
namespace ResellerApi.Entities;

// Immutable full payment of product lines or one PO cost row. Guid.Empty is reserved for historical product subtotal payments.
public class PurchasePayment : BusinessScopedEntity, IBranchScoped
{
    public List<PurchasePaymentItem> Items { get; set; } = [];
    public Guid? BranchId { get; set; }
    public Guid TripId { get; set; }
    public Guid CostKey { get; set; }
    public Guid? PurchaseItemId { get; set; }
    public decimal Amount { get; set; }
    public string FundingSource { get; set; } = null!;
    public Guid? PartnerId { get; set; }
    public Guid CreatedBy { get; set; }
    public Guid RequestId { get; set; }
    public DateTime PaidAt { get; set; }
}

public class PurchasePaymentItem
{
    public Guid PaymentId { get; set; }
    public Guid PurchaseItemId { get; set; }
    public decimal Amount { get; set; }
}
