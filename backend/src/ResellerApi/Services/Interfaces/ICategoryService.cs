using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface ICategoryService
{
    Task<List<CategoryDto>> ListAsync();
    Task<CategoryDto> GetAsync(Guid id);
    Task<CategoryDto> CreateAsync(UpsertCategoryRequest request);
    Task<CategoryDto> UpdateAsync(Guid id, UpsertCategoryRequest request);
    Task DeleteAsync(Guid id);

    Task<CategoryFieldDto> AddFieldAsync(Guid categoryId, UpsertCategoryFieldRequest request);
    Task<CategoryFieldDto> UpdateFieldAsync(Guid categoryId, Guid fieldId, UpsertCategoryFieldRequest request);
    Task DeleteFieldAsync(Guid categoryId, Guid fieldId);
}
