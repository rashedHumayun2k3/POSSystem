using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface IPriceSlotService
{
    Task<List<PriceSlotDto>> GetSlotsAsync(Guid variantId);
    Task<PriceSlotDto> CreateSlotAsync(Guid variantId, CreateSlotRequest request, Guid userId);
    Task ActivateSlotAsync(Guid variantId, Guid slotId, Guid userId);
    Task<List<PriceActivationLogDto>> GetActivationHistoryAsync(Guid variantId);
    // Soft-deletes a slot that is NOT currently active — the frontend only shows Delete for
    // inactive offers, but this is re-validated here too rather than trusted from the client.
    Task DeleteSlotAsync(Guid variantId, Guid slotId, Guid userId);
    // Lazily reconciles which slot should be active right now against StartDate/EndDate windows —
    // called from product read paths (not a background job), including anonymous ClientPage reads,
    // so it needs no caller-supplied user id (any resulting activation is attributed to whoever
    // originally created the relevant slot). Cheap no-op when nothing's due.
    Task EnsureScheduledStateAsync(Guid variantId);
}
