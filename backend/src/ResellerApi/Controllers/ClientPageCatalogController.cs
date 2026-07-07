using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/clientpage")]
[AllowAnonymous]
public class ClientPageCatalogController : ControllerBase
{
    private readonly IClientPageCatalogService _svc;
    private readonly ClientPageShopContext _shopContext;

    public ClientPageCatalogController(IClientPageCatalogService svc, ClientPageShopContext shopContext)
    {
        _svc = svc;
        _shopContext = shopContext;
    }

    [HttpGet("categories")]
    public async Task<IActionResult> Categories()
        => Ok(await _svc.GetCategoriesAsync(_shopContext));

    [HttpGet("shops")]
    public async Task<IActionResult> PopularShops()
        => Ok(await _svc.GetPopularShopsAsync());

    [HttpGet("products")]
    public async Task<IActionResult> Products(
        [FromQuery] string? q, [FromQuery] Guid? categoryId, [FromQuery] bool onlyInStock = false)
        => Ok(await _svc.SearchAsync(_shopContext, q, categoryId, onlyInStock));

    [HttpGet("products/{id:guid}")]
    public async Task<IActionResult> ProductDetail(Guid id)
    {
        var product = await _svc.GetProductDetailAsync(_shopContext, id);
        return product == null ? NotFound() : Ok(product);
    }
}
