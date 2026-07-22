using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.CatalogTemplates;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/catalog-templates")]
[Authorize(Roles = "OWNER")]
public class CatalogTemplatesController : ControllerBase
{
    private readonly ISuggestedCatalogService _catalog;
    private readonly ICurrentUserService _currentUser;
    private readonly IProductService _products;

    public CatalogTemplatesController(ISuggestedCatalogService catalog, ICurrentUserService currentUser, IProductService products)
    {
        _catalog = catalog;
        _currentUser = currentUser;
        _products = products;
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetSuggestedCategories()
    {
        return Ok(await _catalog.GetSuggestedCategoriesAsync());
    }

    [HttpPost("categories")]
    public async Task<IActionResult> AddCategories([FromBody] AddSuggestedCategoriesRequest request)
    {
        return Ok(await _catalog.AddCategoriesAsync(request.SuggestedCategoryIds, _currentUser.UserId));
    }

    [HttpGet("product-categories")]
    public async Task<IActionResult> GetCategoriesWithSuggestions()
    {
        return Ok(await _catalog.GetCategoriesWithSuggestionsAsync());
    }

    [HttpGet("products")]
    public async Task<IActionResult> GetSuggestedProducts([FromQuery] Guid categoryId)
    {
        return Ok(await _catalog.GetSuggestedProductsAsync(categoryId));
    }

    [HttpPost("products")]
    public async Task<IActionResult> AddProducts([FromBody] AddSuggestedProductsRequest request)
    {
        return Ok(await _catalog.AddProductsAsync(request, _currentUser.UserId, _currentUser.IsOwner));
    }

    [HttpGet("added-products")]
    public async Task<IActionResult> GetAddedProducts()
    {
        return Ok(await _products.ListFromSuggestedCategoriesAsync());
    }
}
