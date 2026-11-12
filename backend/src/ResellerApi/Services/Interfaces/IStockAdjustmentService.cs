using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface IStockAdjustmentService
{
    Task<List<StockAdjustmentDto>> GetHistoryAsync(Guid variantId);
    Task<StockHistoryDto> GetTimelineAsync(Guid variantId);
    Task<StockAdjustmentDto> AdjustAsync(Guid variantId, AdjustStockRequest request, Guid userId);
}
