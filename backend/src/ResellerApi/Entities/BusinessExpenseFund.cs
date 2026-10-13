using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// The owner establishes the available capital allocated to expenses, not lifetime investment.
public class BusinessExpenseFund : BusinessScopedEntity
{
    public long OpeningBalancePaisa { get; set; }
    public long RecordedNetPaisaAtOpening { get; set; }
    public Guid InitializedBy { get; set; }
}
