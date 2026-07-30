using ResellerApi.DTOs.Catalog;
using ResellerApi.Services;

namespace ResellerApi.Services.Interfaces;

public interface IProductService
{
    Task<List<ProductSummaryDto>> ListAsync(string? status, Guid? categoryId, string? q);
    Task<List<ProductSummaryDto>> ListFromSuggestedCategoriesAsync();
    Task<object> GetAsync(Guid id, bool isOwner);
    Task<List<ProductSearchResultDto>> SearchAsync(string q, bool onlyInStock = false);
    Task<ProductSearchResultDto?> GetByBarcodeAsync(string barcode);
    Task<List<ProductSearchResultDto>> BrowseAsync(Guid? categoryId, bool onlyInStock = false);
    Task<Dictionary<Guid, decimal>> GetTodaySoldQtyByVariantAsync();
    Task<List<ProductSearchResultDto>> RecentlyPurchasedAsync(int limit);
    Task<List<ActiveCategoryDto>> ActiveCategoriesAsync();
    Task<ProductDetailDto> CreateAsync(CreateProductRequest request, Guid userId);
    Task<ProductDetailDto> UpdateAsync(Guid id, UpdateProductRequest request, Guid userId);
    Task ArchiveAsync(Guid id, Guid userId);
    Task<bool> SetShowOnMarketplaceAsync(Guid id, bool show, Guid userId);
    Task SetMarketplaceDetailsAsync(Guid productId, UpdateMarketplaceDetailsRequest request, Guid userId);
    Task<List<MarketplaceDetailTemplateLabelDto>> GetMarketplaceDetailTemplatesAsync(Guid categoryId);
    Task<ProductImageDto> AddImageAsync(Guid productId, AddProductImageRequest request, Guid userId);
    Task RemoveImageAsync(Guid productId, Guid imageId, Guid userId);
    Task ReorderImagesAsync(Guid productId, ReorderProductImagesRequest request, Guid userId);
    Task<List<VariantLabelData>> GetVariantLabelsAsync(Guid productId, Guid? variantId);

    Task<VariantDto> AddVariantAsync(Guid productId, CreateVariantRequest request, Guid userId);
    Task<VariantDto> UpdateVariantAsync(Guid productId, Guid variantId, UpdateVariantRequest request, Guid userId);
    Task<VariantDto> RecordExistingStockCostAsync(Guid variantId, RecordExistingStockCostRequest request, Guid userId);
    Task<List<VariantDto>> SplitStockIntoVariantsAsync(Guid productId, SplitStockIntoVariantsRequest request, Guid userId);

    Task<List<ProductSalesPointDto>> GetSalesTimeseriesAsync(Guid productId, string range);
}
