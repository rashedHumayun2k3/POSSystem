using ResellerApi.DTOs.Catalog;
using ResellerApi.DTOs.CatalogTemplates;

namespace ResellerApi.Services.Interfaces;

public interface ISuggestedCatalogService
{
    Task<List<SuggestedCategoryDto>> GetSuggestedCategoriesAsync();
    Task<List<CategoryDto>> AddCategoriesAsync(List<Guid> suggestedCategoryIds, Guid userId);
    Task<List<CategoryWithSuggestionsDto>> GetCategoriesWithSuggestionsAsync();
    Task<List<SuggestedProductDto>> GetSuggestedProductsAsync(Guid categoryId);
    Task<List<AddSuggestedProductsResultItem>> AddProductsAsync(AddSuggestedProductsRequest request, Guid userId, bool isOwner);
}
