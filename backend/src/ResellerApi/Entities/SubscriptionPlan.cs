using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class SubscriptionPlan : BaseEntity
{
    public string Code { get; set; } = null!;   // TRIAL | STARTER | GROWTH | BUSINESS
    public string Name { get; set; } = null!;
    public int StaffSeatLimit { get; set; }     // int.MaxValue = unlimited
    public int BranchLimit { get; set; }        // int.MaxValue = unlimited
    public decimal PriceMonthly { get; set; }
    public decimal PriceYearly { get; set; }
    public bool IsPurchasable { get; set; } = true; // false for the internal TRIAL plan
    public bool IsActive { get; set; } = true;

    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
}
