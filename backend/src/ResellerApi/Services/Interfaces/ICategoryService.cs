using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface ICategoryService
{
    Task<List<CategoryDto>> ListAsync();
    Task<CategoryDto> GetAsync(Guid id);
    Task<CategoryDto> CreateAsync(UpsertCategoryRequest request, Guid userId);
    Task<CategoryDto> UpdateAsync(Guid id, UpsertCategoryRequest request, Guid userId);
    Task DeleteAsync(Guid id, Guid userId);

    Task<CategoryFieldDto> AddFieldAsync(Guid categoryId, UpsertCategoryFieldRequest request, Guid userId);
    Task<CategoryFieldDto> UpdateFieldAsync(Guid categoryId, Guid fieldId, UpsertCategoryFieldRequest request, Guid userId);
    Task DeleteFieldAsync(Guid categoryId, Guid fieldId, Guid userId);
}
