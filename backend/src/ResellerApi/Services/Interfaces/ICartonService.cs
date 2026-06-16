using ResellerApi.DTOs.Cartons;

namespace ResellerApi.Services.Interfaces;

public interface ICartonService
{
    Task<List<CartonSummaryDto>> ListAsync(Guid? tripId, string? status, Guid? variantId);
    Task<CartonDetailDto> GetAsync(Guid id);
    Task<List<CartonSummaryDto>> BulkCreateAsync(BulkCreateCartonsRequest request, Guid userId);
    Task<CartonDetailDto> UpdateAsync(Guid id, UpdateCartonRequest request, Guid userId);
    Task<CartonDetailDto> OpenAsync(Guid id, OpenCartonRequest request, Guid userId);
    Task<CartonDetailDto> LabelItemAsync(Guid cartonId, Guid itemId, LabelCartonItemRequest request, Guid userId);
    Task DeleteAsync(Guid id, Guid userId);

    // ── Reports ───────────────────────────────────────────────────────────────
    Task<StoreroomSummaryDto> GetSummaryAsync();
    Task<List<LocationLookupItemDto>> LocationLookupAsync(Guid variantId);
    Task<List<DamagedItemDto>> GetDamagedAsync();
    Task<List<TripWithCartonsDto>> GetTripsWithCartonsAsync();
}
