using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface ICategoryPresetService
{
    Task<List<CategoryDto>> ApplyPresetAsync(Guid businessId, string businessType);
}
