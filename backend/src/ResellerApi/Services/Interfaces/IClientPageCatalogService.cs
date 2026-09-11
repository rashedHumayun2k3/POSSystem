using ResellerApi.DTOs.ClientPage;
using ResellerApi.DTOs.Common;
using ResellerApi.Infrastructure;

namespace ResellerApi.Services.Interfaces;

public interface IClientPageCatalogService
{
    Task<List<ClientPageCategoryDto>> GetCategoriesAsync(ClientPageShopContext shopContext);
    Task<List<ClientPageShopDto>> GetPopularShopsAsync();
    Task<PagedResult<ClientPageProductCardDto>> SearchAsync(
        ClientPageShopContext shopContext, string? q, Guid? categoryId, bool onlyInStock,
        string sort = "default", int page = 1, int pageSize = 60);
    Task<ClientPageProductDetailDto?> GetProductDetailAsync(ClientPageShopContext shopContext, Guid productId);
    Task<List<ClientPageProductCardDto>> GetRelatedProductsAsync(ClientPageShopContext shopContext, Guid productId, int take = 8);
}
