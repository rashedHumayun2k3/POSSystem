using ResellerApi.DTOs.Suppliers;

namespace ResellerApi.Services.Interfaces;

public interface ISuppliersService
{
    Task<List<SupplierDto>> ListAsync(string? search, int? limit, string? sort);
    Task<SupplierDto> GetAsync(Guid id);
    Task<SupplierDto> CreateAsync(CreateSupplierRequest request, Guid userId);
    Task<SupplierDto> UpdateAsync(Guid id, UpdateSupplierRequest request, Guid userId);
    Task DeleteAsync(Guid id, Guid userId);
}
