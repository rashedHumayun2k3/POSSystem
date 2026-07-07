using ResellerApi.DTOs.ClientPage;
using ResellerApi.Infrastructure;

namespace ResellerApi.Services.Interfaces;

public interface IClientPageCatalogService
{
    Task<List<ClientPageCategoryDto>> GetCategoriesAsync(ClientPageShopContext shopContext);
    Task<List<ClientPageShopDto>> GetPopularShopsAsync();
    Task<List<ClientPageProductCardDto>> SearchAsync(ClientPageShopContext shopContext, string? q, Guid? categoryId, bool onlyInStock);
    Task<ClientPageProductDetailDto?> GetProductDetailAsync(ClientPageShopContext shopContext, Guid productId);
}
