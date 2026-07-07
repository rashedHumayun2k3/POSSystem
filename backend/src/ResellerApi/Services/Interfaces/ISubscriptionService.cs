using ResellerApi.DTOs.Subscriptions;

namespace ResellerApi.Services.Interfaces;

public interface ISubscriptionService
{
    Task StartTrialAsync(Guid companyId);
    Task<List<SubscriptionPlanDto>> GetPurchasablePlansAsync();
    Task<SubscriptionStatusDto> GetStatusAsync(Guid companyId);
    Task EnsureCanAddStaffAsync(Guid companyId);
    Task EnsureCanAddBranchAsync(Guid companyId);
    Task<bool> IsReadOnlyLockedAsync(Guid companyId);
    Task<StartCheckoutResponse> StartCheckoutAsync(Guid companyId, StartCheckoutRequest request);
    Task HandleBkashCallbackAsync(string paymentId, string bkashStatus);
    Task ExpireDueSubscriptionsAsync();
}
