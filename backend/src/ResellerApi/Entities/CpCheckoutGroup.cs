using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// Ties together the independent per-business Orders created from one guest checkout that
// spanned multiple shops (marketplace-mode cart). Deliberately NOT a BusinessScopedEntity —
// it exists precisely because it crosses the tenant boundary. Carries no money/business-logic
// fields itself; it's a receipt-grouping record for the ClientPage confirmation page only.
public class CpCheckoutGroup : BaseEntity
{
    public string CustomerName { get; set; } = null!;
    public string CustomerPhone { get; set; } = null!;

    public ICollection<CpCheckoutGroupOrder> Orders { get; set; } = new List<CpCheckoutGroupOrder>();
}
