using ResellerApi.Entities.Base;
namespace ResellerApi.Entities;

// Immutable full payment of one PO cost row. Guid.Empty identifies the product subtotal.
public class PurchasePayment : BusinessScopedEntity, IBranchScoped
{
    public Guid? BranchId { get; set; }
    public Guid TripId { get; set; }
    public Guid CostKey { get; set; }
    public decimal Amount { get; set; }
    public string FundingSource { get; set; } = null!;
    public Guid? PartnerId { get; set; }
    public Guid CreatedBy { get; set; }
    public Guid RequestId { get; set; }
    public DateTime PaidAt { get; set; }
}
