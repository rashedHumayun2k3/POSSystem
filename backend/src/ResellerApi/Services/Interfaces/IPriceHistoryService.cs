using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface IPriceHistoryService
{
    Task<List<PriceHistoryDto>> GetHistoryAsync(Guid variantId);
    Task<PriceHistoryDto> ChangePriceAsync(ChangePriceRequest request, Guid userId);
    Task ApplyScheduledPriceChangesAsync();
}
