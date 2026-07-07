using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Subscription : BaseEntity
{
    public Guid CompanyId { get; set; }
    public Guid PlanId { get; set; }
    public string Status { get; set; } = null!; // TRIALING | ACTIVE | PAST_DUE | CANCELED | EXPIRED
    public string BillingCycle { get; set; } = "MONTHLY"; // MONTHLY | YEARLY
    public DateTime? TrialEndsAt { get; set; }
    public DateTime? CurrentPeriodStart { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public DateTime? CanceledAt { get; set; }

    // Set when a checkout is started, consumed once the bKash callback confirms payment —
    // lets the callback know which plan/cycle the pending SubscriptionPayment is actually for.
    public Guid? PendingPlanId { get; set; }
    public string? PendingBillingCycle { get; set; }

    public Company Company { get; set; } = null!;
    public SubscriptionPlan Plan { get; set; } = null!;
    public ICollection<SubscriptionPayment> Payments { get; set; } = new List<SubscriptionPayment>();
}
