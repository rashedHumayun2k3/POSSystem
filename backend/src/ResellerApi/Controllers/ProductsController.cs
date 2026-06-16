using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductService _svc;
    private readonly IPriceHistoryService _priceSvc;
    private readonly ICurrentUserService _user;

    public ProductsController(IProductService svc, IPriceHistoryService priceSvc, ICurrentUserService user)
    {
        _svc = svc;
        _priceSvc = priceSvc;
        _user = user;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] Guid? categoryId,
        [FromQuery] string? q)
    {
        var products = await _svc.ListAsync(status, categoryId, q);
        if (!_user.CanSeeCosts)
        {
            return Ok(products.Select(p => new
            {
                p.Id, p.Name, p.Sku, p.ImageUrl, p.UnitCode,
                p.SellingPrice, p.MarketPrice, p.Status,
                p.CategoryName, p.VariantCount, p.TotalStock
            }));
        }
        return Ok(products);
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());
        return Ok(await _svc.SearchAsync(q));
    }

    [HttpGet("browse")]
    public async Task<IActionResult> Browse([FromQuery] Guid? categoryId)
        => Ok(await _svc.BrowseAsync(categoryId));

    [HttpGet("recently-purchased")]
    public async Task<IActionResult> RecentlyPurchased([FromQuery] int limit = 5)
        => Ok(await _svc.RecentlyPurchasedAsync(Math.Clamp(limit, 1, 20)));

    [HttpGet("active-categories")]
    public async Task<IActionResult> ActiveCategories()
        => Ok(await _svc.ActiveCategoriesAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
        => Ok(await _svc.GetAsync(id, _user.IsOwner));

    [HttpPost]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest request)
    {
        var product = await _svc.CreateAsync(request, _user.UserId);
        return CreatedAtAction(nameof(Get), new { id = product.Id }, product);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductRequest request)
        => Ok(await _svc.UpdateAsync(id, request, _user.UserId));

    [HttpPatch("{id:guid}/archive")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Archive(Guid id)
    {
        await _svc.ArchiveAsync(id, _user.UserId);
        return NoContent();
    }

    // ── Variants ───────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/variants")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> AddVariant(Guid id, [FromBody] CreateVariantRequest request)
        => Ok(await _svc.AddVariantAsync(id, request, _user.UserId));

    [HttpPut("{id:guid}/variants/{variantId:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> UpdateVariant(Guid id, Guid variantId, [FromBody] UpdateVariantRequest request)
        => Ok(await _svc.UpdateVariantAsync(id, variantId, request, _user.UserId));

    // ── Price history ─────────────────────────────────────────────────────────

    [HttpGet("variants/{variantId:guid}/prices")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> GetPriceHistory(Guid variantId)
        => Ok(await _priceSvc.GetHistoryAsync(variantId));

    [HttpPost("variants/{variantId:guid}/prices")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> ChangePrice(Guid variantId, [FromBody] ChangePriceRequest request)
    {
        var req = request with { VariantId = variantId };
        return Ok(await _priceSvc.ChangePriceAsync(req, _user.UserId));
    }
}
