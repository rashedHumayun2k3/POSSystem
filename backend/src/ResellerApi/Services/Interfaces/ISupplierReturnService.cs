using ResellerApi.DTOs.SupplierReturns;

namespace ResellerApi.Services.Interfaces;

public interface ISupplierReturnService
{
    Task<List<SupplierReturnListDto>> ListAsync(string? status, Guid? supplierId);
    Task<SupplierReturnDetailDto> GetAsync(Guid id);
    Task<List<DamagedStockItemDto>> ListDamagedStockAsync(Guid? branchId, string? search);
    Task<SupplierReturnDetailDto> CreateAsync(CreateSupplierReturnRequest request, Guid userId);

    Task<SupplierReturnDetailDto> AddItemAsync(Guid returnId, AddSupplierReturnItemRequest request);
    Task<SupplierReturnDetailDto> UpdateItemAsync(Guid returnId, Guid itemId, UpdateSupplierReturnItemRequest request);
    Task RemoveItemAsync(Guid returnId, Guid itemId);

    Task<SupplierReturnDetailDto> SubmitAsync(Guid returnId, Guid userId);
    Task<SupplierReturnDetailDto> ResolveAsync(Guid returnId, Guid userId);
    Task<SupplierReturnDetailDto> CancelAsync(Guid returnId, Guid userId);
}
