using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface IProductService
{
    Task<List<ProductSummaryDto>> ListAsync(string? status, Guid? categoryId, string? q);
    Task<object> GetAsync(Guid id, bool isOwner);
    Task<List<ProductSearchResultDto>> SearchAsync(string q);
    Task<List<ProductSearchResultDto>> BrowseAsync(Guid? categoryId);
    Task<List<ProductSearchResultDto>> RecentlyPurchasedAsync(int limit);
    Task<List<ActiveCategoryDto>> ActiveCategoriesAsync();
    Task<ProductDetailDto> CreateAsync(CreateProductRequest request, Guid userId);
    Task<ProductDetailDto> UpdateAsync(Guid id, UpdateProductRequest request, Guid userId);
    Task ArchiveAsync(Guid id, Guid userId);

    Task<VariantDto> AddVariantAsync(Guid productId, CreateVariantRequest request, Guid userId);
    Task<VariantDto> UpdateVariantAsync(Guid productId, Guid variantId, UpdateVariantRequest request, Guid userId);
}
