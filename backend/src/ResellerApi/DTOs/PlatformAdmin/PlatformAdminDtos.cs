namespace ResellerApi.DTOs.PlatformAdmin;

public record PlatformAdminLoginRequest(string Username, string Password);

public record PlatformAdminLoginResponse(string AccessToken);

public record AdminCompanyListItemDto(
    Guid Id,
    string Name,
    string Status,
    DateTime CreatedAt,
    int BusinessCount,
    int UserCount,
    string? PlanCode,
    string? SubscriptionStatus,
    DateTime? TrialEndsAt,
    DateTime? CurrentPeriodEnd,
    decimal TotalFeesPaid,
    Guid? PrimaryBusinessId,
    bool ShowOnMarketplace
);

public record SetCompanyStatusRequest(string Status, string? Note);

public record ExtendSubscriptionRequest(int? AddDays, DateTime? NewPeriodEnd, decimal? AmountCollected, string? Note);

public record SetMarketplaceVisibilityRequest(bool Show, string? Note);

public record PlatformAdminStatsDto(
    int TotalCompanies,
    int NewThisWeek,
    int NewThisMonth,
    int TrialingCount,
    int ActivePaidCount,
    decimal TotalRevenueCollected
);
