using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface IPriceSlotService
{
    Task<List<PriceSlotDto>> GetSlotsAsync(Guid variantId);
    Task<PriceSlotDto> CreateSlotAsync(Guid variantId, CreateSlotRequest request, Guid userId);
    Task ActivateSlotAsync(Guid variantId, Guid slotId, Guid userId);
    Task<List<PriceActivationLogDto>> GetActivationHistoryAsync(Guid variantId);
}
