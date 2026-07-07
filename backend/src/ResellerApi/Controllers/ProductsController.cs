using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductService _svc;
    private readonly IPriceHistoryService _priceSvc;
    private readonly IPriceSlotService _slotSvc;
    private readonly IOrderService _orderSvc;
    private readonly ICurrentUserService _user;

    public ProductsController(IProductService svc, IPriceHistoryService priceSvc, IPriceSlotService slotSvc, IOrderService orderSvc, ICurrentUserService user)
    {
        _svc = svc;
        _priceSvc = priceSvc;
        _slotSvc = slotSvc;
        _orderSvc = orderSvc;
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
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] bool onlyInStock = false)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());
        return Ok(await _svc.SearchAsync(q, onlyInStock));
    }

    [HttpGet("barcode/{barcode}")]
    public async Task<IActionResult> LookupBarcode(string barcode)
    {
        var result = await _svc.GetByBarcodeAsync(barcode);
        if (result == null) return NotFound(new { message = $"No product found for barcode: {barcode}" });
        return Ok(result);
    }

    [HttpGet("browse")]
    public async Task<IActionResult> Browse([FromQuery] Guid? categoryId, [FromQuery] bool onlyInStock = false)
        => Ok(await _svc.BrowseAsync(categoryId, onlyInStock));

    [HttpGet("recently-purchased")]
    public async Task<IActionResult> RecentlyPurchased([FromQuery] int limit = 5)
        => Ok(await _svc.RecentlyPurchasedAsync(Math.Clamp(limit, 1, 20)));

    [HttpGet("active-categories")]
    public async Task<IActionResult> ActiveCategories()
        => Ok(await _svc.ActiveCategoriesAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
        => Ok(await _svc.GetAsync(id, _user.IsOwner));

    [HttpGet("{id:guid}/barcode-labels")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> BarcodeLabels(
        Guid id,
        [FromQuery] int qty = 1,
        [FromQuery] Guid? variantId = null)
    {
        qty = Math.Clamp(qty, 1, 500);
        var labels = await _svc.GetVariantLabelsAsync(id, variantId);
        if (labels.Count == 0) return NotFound(new { message = "No variants found." });
        var pdf = BarcodeLabelPdfGenerator.Generate(labels, qty);
        return File(pdf, "application/pdf", $"labels-{id}.pdf");
    }

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

    // ── Price slots ───────────────────────────────────────────────────────────

    [HttpGet("variants/{variantId:guid}/slots")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> GetSlots(Guid variantId)
        => Ok(await _slotSvc.GetSlotsAsync(variantId));

    [HttpPost("variants/{variantId:guid}/slots")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> CreateSlot(Guid variantId, [FromBody] CreateSlotRequest request)
        => Ok(await _slotSvc.CreateSlotAsync(variantId, request, _user.UserId));

    [HttpPost("variants/{variantId:guid}/slots/{slotId:guid}/activate")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> ActivateSlot(Guid variantId, Guid slotId)
    {
        await _slotSvc.ActivateSlotAsync(variantId, slotId, _user.UserId);
        return NoContent();
    }

    [HttpGet("variants/{variantId:guid}/slot-history")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> GetSlotHistory(Guid variantId)
        => Ok(await _slotSvc.GetActivationHistoryAsync(variantId));

    [HttpGet("{id:guid}/orders")]
    public async Task<IActionResult> OrdersByProduct(Guid id)
        => Ok(await _orderSvc.ListByProductAsync(id, _user.CanSeeCosts));
}
