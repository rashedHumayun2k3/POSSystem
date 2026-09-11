namespace ResellerApi.DTOs.Subscriptions;

public record SubscriptionPlanDto(
    Guid Id,
    string Code,
    string Name,
    int StaffSeatLimit,
    int BranchLimit,
    decimal PriceMonthly,
    decimal PriceYearly
);

public record SubscriptionStatusDto(
    string Status,
    string PlanCode,
    string PlanName,
    string BillingCycle,
    DateTime? TrialEndsAt,
    DateTime? CurrentPeriodEnd,
    int StaffSeatLimit,
    int StaffSeatsUsed,
    int BranchLimit,
    int BranchesUsed,
    bool IsReadOnlyLocked
);

public record StartCheckoutRequest(string PlanCode, string BillingCycle);

public record StartCheckoutResponse(string BkashPaymentId, string BkashRedirectUrl);
