using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Catalog;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;
using System.Net.Mail;

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
    private readonly IEmailSender _emailSender;

    public ProductsController(IProductService svc, IPriceHistoryService priceSvc, IPriceSlotService slotSvc, IOrderService orderSvc, IStockAdjustmentService stockAdjSvc, IProductReviewService reviewSvc, ICurrentUserService user, IBusinessContext business, IEmailSender emailSender)
    {
        _svc = svc;
        _priceSvc = priceSvc;
        _slotSvc = slotSvc;
        _orderSvc = orderSvc;
        _stockAdjSvc = stockAdjSvc;
        _reviewSvc = reviewSvc;
        _user = user;
        _business = business;
        _emailSender = emailSender;
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
                p.CategoryName, p.VariantCount, p.TotalStock,
                p.AverageRating, p.ReviewCount, p.ShowOnMarketplace, p.OrderCount,
                p.WholesaleMinQty, p.WholesaleUnitPrice
                // BuyPrice/TotalProfit deliberately omitted — STAFF must never see cost/profit (rule GTR-10)
            }));
        }
        return Ok(products);
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] bool onlyInStock = false)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());
        var results = await _svc.SearchAsync(q, onlyInStock);
        return Ok(_user.CanSeeCosts ? results : results.Select(StripCost));
    }

    [HttpGet("barcode/{barcode}")]
    public async Task<IActionResult> LookupBarcode(string barcode)
    {
        var result = await _svc.GetByBarcodeAsync(barcode);
        if (result == null) return NotFound(new { message = $"No product found for barcode: {barcode}" });
        return Ok(_user.CanSeeCosts ? result : StripCost(result));
    }

    [HttpGet("browse")]
    public async Task<IActionResult> Browse([FromQuery] Guid? categoryId, [FromQuery] bool onlyInStock = false)
    {
        var results = await _svc.BrowseAsync(categoryId, onlyInStock);
        return Ok(_user.CanSeeCosts ? results : results.Select(StripCost));
    }

    // AvgLandedCost deliberately omitted — STAFF must never see cost/profit (rule GTR-10). Search,
    // barcode lookup, and browse all share this shape since STAFF reaches all three (POS, order
    // creation, barcode scanning).
    private static object StripCost(ProductSearchResultDto p) => new
    {
        p.Id, p.VariantId, p.Name, p.Sku, p.Barcode, p.EffectivePrice, p.ImageUrl, p.UnitCode,
        p.VariantValuesJson, p.Stock, p.MarketPrice, p.WholesaleMinQty, p.WholesaleUnitPrice, p.CategoryId
    };

    [HttpGet("today-sold")]
    public async Task<IActionResult> TodaySold()
        => Ok(await _svc.GetTodaySoldQtyByVariantAsync());

    // Owner/Manager only — profit is cost-sensitive (GTR-10). Kept as its own endpoint rather than
    // folded into TodaySold, which STAFF can also call — adding Profit there would leak cost data
    // to STAFF in the raw response even though the UI hides it.
    [HttpGet("today-hawker-profit")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> TodayHawkerProfit()
        => Ok(await _svc.GetTodayHawkerProfitAsync());

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

    [HttpPost("barcode-labels/batch")]
    [Authorize(Roles = Roles.OwnerManagerWarehouse)]
    public async Task<IActionResult> BarcodeLabelBatch([FromBody] BarcodeLabelBatchRequest request)
    {
        var result = await CreateBarcodeLabelBatchAsync(request);
        if (result.Error is not null) return BadRequest(new { message = result.Error });
        return File(result.Pdf!, "application/pdf", BarcodeLabelFileName());
    }

    [HttpPost("barcode-labels/batch/send")]
    [Authorize(Roles = Roles.OwnerManagerWarehouse)]
    public async Task<IActionResult> SendBarcodeLabelBatch([FromBody] BarcodeLabelBatchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !MailAddress.TryCreate(request.Email.Trim(), out var recipient))
            return BadRequest(new { message = "Enter a valid recipient email address." });

        var result = await CreateBarcodeLabelBatchAsync(request);
        if (result.Error is not null) return BadRequest(new { message = result.Error });

        var fileName = BarcodeLabelFileName();
        try
        {
            await _emailSender.SendEmailWithAttachmentAsync(
                recipient.Address,
                "Product barcode labels",
                "<p>Your print-ready product barcode labels are attached.</p><p>Print at <strong>100% / Actual Size</strong> without Fit to Page scaling. Match the printer paper size to the PDF page size.</p>",
                result.Pdf!,
                fileName,
                "application/pdf");
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Could not send barcode labels: {ex.Message}" });
        }

        return Ok(new { message = $"Barcode PDF sent to {recipient.Address}." });
    }

    private async Task<(byte[]? Pdf, string? Error)> CreateBarcodeLabelBatchAsync(BarcodeLabelBatchRequest request)
    {
        var validationError = ValidateBarcodeLabelBatch(request);
        if (validationError is not null) return (null, validationError);

        var requestedIds = request.Items.Select(item => item.VariantId).ToList();
        var labels = await _svc.GetVariantLabelsByIdsAsync(requestedIds);
        if (labels.Count != requestedIds.Count)
            return (null, "One or more products are unavailable or do not belong to this business.");

        var printItems = new List<BarcodeLabelPrintItem>(request.Items.Count);
        foreach (var item in request.Items)
        {
            var label = labels[item.VariantId];
            var barcodeError = ValidateStoredBarcode(label.Barcode);
            if (barcodeError is not null) return (null, $"{label.ProductName}: {barcodeError}");
            printItems.Add(new BarcodeLabelPrintItem(label, item.Quantity));
        }

        try
        {
            return (BarcodeLabelPdfGenerator.GenerateBatch(printItems, request), null);
        }
        catch (Exception ex)
        {
            return (null, $"Could not create the barcode PDF: {ex.Message}");
        }
    }

    private static string? ValidateBarcodeLabelBatch(BarcodeLabelBatchRequest request)
    {
        if (request.Items is null || request.Items.Count == 0) return "Select at least one product.";
        if (request.Items.Count != request.Items.Select(item => item.VariantId).Distinct().Count()) return "Each product variant can only appear once.";
        if (request.Items.Any(item => item.VariantId == Guid.Empty || item.Quantity is < 1 or > 500)) return "Each label quantity must be between 1 and 500.";
        if (request.Items.Sum(item => item.Quantity) > 1000) return "A batch can contain at most 1000 labels.";

        if (string.Equals(request.Mode, "A4", StringComparison.OrdinalIgnoreCase))
        {
            if (request.A4 is null) return "A4 template settings are required.";
            var a4 = request.A4;
            if (a4.LabelWidth <= 0 || a4.LabelHeight <= 0 || a4.Columns is < 1 or > 12 || a4.Rows is < 1 or > 30)
                return "A4 label dimensions, rows, and columns are invalid.";
            if (new[] { a4.HorizontalGap, a4.VerticalGap, a4.MarginTop, a4.MarginRight, a4.MarginBottom, a4.MarginLeft }.Any(value => value < 0))
                return "A4 gaps and margins cannot be negative.";
            var usedWidth = a4.MarginLeft + a4.MarginRight + a4.Columns * a4.LabelWidth + (a4.Columns - 1) * a4.HorizontalGap;
            var usedHeight = a4.MarginTop + a4.MarginBottom + a4.Rows * a4.LabelHeight + (a4.Rows - 1) * a4.VerticalGap;
            if (usedWidth > 210 || usedHeight > 297) return "The configured labels do not fit on an A4 page.";
            var positions = a4.Columns * a4.Rows;
            if (request.StartPosition < 1 || request.StartPosition > positions) return $"Start position must be between 1 and {positions}.";
            return null;
        }

        if (string.Equals(request.Mode, "ROLL", StringComparison.OrdinalIgnoreCase))
        {
            if (request.Roll is null) return "Label roll size is required.";
            if (request.Roll.Width is < 20 or > 150 || request.Roll.Height is < 15 or > 150)
                return "Roll width must be 20-150 mm and height must be 15-150 mm.";
            return null;
        }

        return "Print mode must be A4 or ROLL.";
    }

    private static string? ValidateStoredBarcode(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "The product has no stored barcode.";
        if (value.Length > 80 || value.Any(character => character < 32 || character > 126)) return "The barcode cannot be encoded as Code 128.";
        if (value.Length == 13 && value.All(char.IsDigit))
        {
            var sum = value.Take(12).Select((character, index) => (character - '0') * (index % 2 == 0 ? 1 : 3)).Sum();
            var expected = (10 - sum % 10) % 10;
            if (value[12] - '0' != expected) return "The 13-digit barcode has an invalid EAN-13 check digit.";
        }
        return null;
    }

    private static string BarcodeLabelFileName() => $"barcode-labels-{DateTime.UtcNow:yyyy-MM-dd}.pdf";

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
    public async Task<IActionResult> GetMarketplaceDetailTemplates([FromQuery] Guid categoryId)
    {
        try
        {
            return Ok(await _svc.GetMarketplaceDetailTemplatesAsync(categoryId));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

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

    [HttpPost("{id:guid}/variants/split")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> SplitStockIntoVariants(Guid id, [FromBody] SplitStockIntoVariantsRequest request)
    {
        try
        {
            return Ok(await _svc.SplitStockIntoVariantsAsync(id, request, _user.UserId));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("variants/{variantId:guid}/existing-stock-cost")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> RecordExistingStockCost(Guid variantId, [FromBody] RecordExistingStockCostRequest request)
    {
        try
        {
            return Ok(await _svc.RecordExistingStockCostAsync(variantId, request, _user.UserId));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

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

    [HttpDelete("variants/{variantId:guid}/slots/{slotId:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> DeleteSlot(Guid variantId, Guid slotId)
    {
        await _slotSvc.DeleteSlotAsync(variantId, slotId, _user.UserId);
        return NoContent();
    }

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

    [HttpGet("{id:guid}/sales-timeseries")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> SalesTimeseries(Guid id, [FromQuery] string range = "7d")
    {
        try { return Ok(await _svc.GetSalesTimeseriesAsync(id, range)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

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
