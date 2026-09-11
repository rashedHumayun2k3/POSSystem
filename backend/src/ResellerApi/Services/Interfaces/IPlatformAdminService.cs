using ResellerApi.DTOs.PlatformAdmin;

namespace ResellerApi.Services.Interfaces;

public interface IPlatformAdminService
{
    Task<PlatformAdminLoginResponse> LoginAsync(PlatformAdminLoginRequest request);
    Task<List<AdminCompanyListItemDto>> GetCompaniesAsync(string? search);
    Task SetCompanyStatusAsync(Guid companyId, SetCompanyStatusRequest request);
    Task ExtendSubscriptionAsync(Guid companyId, ExtendSubscriptionRequest request);
    Task SetMarketplaceVisibilityAsync(Guid companyId, SetMarketplaceVisibilityRequest request);
    Task<PlatformAdminStatsDto> GetStatsAsync();

    Task<List<CourierCatalogDto>> GetCourierCatalogAsync();
    Task<CourierCatalogDto> CreateCourierCatalogAsync(CourierCatalogRequest request);
    Task UpdateCourierCatalogAsync(Guid id, CourierCatalogRequest request);
    Task DeleteCourierCatalogAsync(Guid id);
}
