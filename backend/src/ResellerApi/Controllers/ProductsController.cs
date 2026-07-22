using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Catalog;
using ResellerApi.DTOs.ClientPage;
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
    private readonly IStockAdjustmentService _stockAdjSvc;
    private readonly IProductReviewService _reviewSvc;
    private readonly ICurrentUserService _user;
    private readonly IBusinessContext _business;

    public ProductsController(IProductService svc, IPriceHistoryService priceSvc, IPriceSlotService slotSvc, IOrderService orderSvc, IStockAdjustmentService stockAdjSvc, IProductReviewService reviewSvc, ICurrentUserService user, IBusinessContext business)
    {
        _svc = svc;
        _priceSvc = priceSvc;
        _slotSvc = slotSvc;
        _orderSvc = orderSvc;
        _stockAdjSvc = stockAdjSvc;
        _reviewSvc = reviewSvc;
        _user = user;
        _business = business;
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
                p.SellingPrice, p.MarketPrice, p.MarketplacePrice, p.Status,
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
        try
        {
            var product = await _svc.CreateAsync(request, _user.UserId);
            return CreatedAtAction(nameof(Get), new { id = product.Id }, product);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
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

    [HttpPatch("{id:guid}/marketplace-visibility")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> SetMarketplaceVisibility(Guid id, [FromBody] SetProductMarketplaceVisibilityRequest request)
    {
        var showOnMarketplace = await _svc.SetShowOnMarketplaceAsync(id, request.Show, _user.UserId);
        return Ok(new { showOnMarketplace });
    }

    [HttpPut("{id:guid}/marketplace-details")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> UpdateMarketplaceDetails(Guid id, [FromBody] UpdateMarketplaceDetailsRequest request)
    {
        try
        {
            await _svc.SetMarketplaceDetailsAsync(id, request, _user.UserId);
            return NoContent();
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpGet("marketplace-detail-templates")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> GetMarketplaceDetailTemplates()
        => Ok(await _svc.GetMarketplaceDetailTemplatesAsync());

    [HttpPost("{id:guid}/images")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> AddImage(Guid id, [FromBody] AddProductImageRequest request)
    {
        try { return Ok(await _svc.AddImageAsync(id, request, _user.UserId)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> RemoveImage(Guid id, Guid imageId)
    {
        try { await _svc.RemoveImageAsync(id, imageId, _user.UserId); return NoContent(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}/images/reorder")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> ReorderImages(Guid id, [FromBody] ReorderProductImagesRequest request)
    {
        try { await _svc.ReorderImagesAsync(id, request, _user.UserId); return NoContent(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
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

    // ── Stock adjustments ──────────────────────────────────────────────────────

    [HttpGet("variants/{variantId:guid}/stock-adjustments")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> GetStockAdjustments(Guid variantId)
        => Ok(await _stockAdjSvc.GetHistoryAsync(variantId));

    [HttpPost("variants/{variantId:guid}/stock-adjustments")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> AdjustStock(Guid variantId, [FromBody] AdjustStockRequest request)
    {
        try { return Ok(await _stockAdjSvc.AdjustAsync(variantId, request, _user.UserId)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("{id:guid}/orders")]
    public async Task<IActionResult> OrdersByProduct(Guid id)
        => Ok(await _orderSvc.ListByProductAsync(id, _user.CanSeeCosts));

    [HttpGet("{id:guid}/reviews")]
    public async Task<IActionResult> ReviewsByProduct(Guid id)
        => Ok(await _reviewSvc.GetReviewsForStaffAsync(_business.CurrentBusinessId, id));

    [HttpPost("{id:guid}/reviews/{reviewId:guid}/reply")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> ReplyToReview(Guid id, Guid reviewId, [FromBody] ReplyToReviewRequest request)
    {
        try
        {
            await _reviewSvc.ReplyAsync(_business.CurrentBusinessId, reviewId, _user.UserId, request);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}/reviews/{reviewId:guid}/reply")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> DeleteReviewReply(Guid id, Guid reviewId)
    {
        try
        {
            await _reviewSvc.DeleteReplyAsync(_business.CurrentBusinessId, reviewId);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPatch("{id:guid}/reviews/{reviewId:guid}/hide")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> SetReviewHidden(Guid id, Guid reviewId, [FromBody] bool hidden)
    {
        try
        {
            await _reviewSvc.SetHiddenAsync(_business.CurrentBusinessId, reviewId, hidden);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }
}
