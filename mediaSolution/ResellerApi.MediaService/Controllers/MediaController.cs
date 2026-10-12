using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using ResellerApi.MediaService.Data;
using ResellerApi.MediaService.Services;

namespace ResellerApi.MediaService.Controllers;

[ApiController]
[Route("api/v1/media")]
public class MediaController : ControllerBase
{
    private readonly MediaDbContext _db;
    private readonly MediaStorageService _storage;

    public MediaController(MediaDbContext db, MediaStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    // Staff upload — products, banners, profile photos. Any authenticated staff JWT (no role
    // restriction), same as the original MediaController on the main API. The X-Business-Id
    // header is client-supplied and therefore untrusted on its own — we re-verify membership
    // against business_users here (mirrors BusinessContextMiddleware on the main API) so a
    // spoofed header can never write into another business's folder.
    [HttpPost("upload")]
    [Authorize]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        var businessIdHeader = Request.Headers["X-Business-Id"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(businessIdHeader) || !Guid.TryParse(businessIdHeader, out var businessId))
            return BadRequest(new { code = "MISSING_BUSINESS_ID", message = "X-Business-Id header is required." });

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var hasAccess = await _db.BusinessUsers.AsNoTracking()
            .AnyAsync(bu => bu.BusinessId == businessId && bu.UserId == userId);
        if (!hasAccess)
            return StatusCode(403, new { code = "BUSINESS_ACCESS_DENIED", message = "You do not have access to this business." });

        try
        {
            var url = await _storage.SaveFileAsync(file, businessId);
            return Ok(new { url });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { code = "INVALID_FILE", message = ex.Message });
        }
    }

    // Cleanup only after the caller has removed the product/gallery reference.
    [HttpDelete("product-image")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> DeleteProductImage([FromQuery] string url)
    {
        if (!Guid.TryParse(Request.Headers["X-Business-Id"].FirstOrDefault(), out var businessId))
            return BadRequest(new { message = "X-Business-Id header is required." });
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
            !await _db.BusinessUsers.AnyAsync(x => x.BusinessId == businessId && x.UserId == userId))
            return Forbid();
        try
        {
            _storage.GetOwnedImagePath(url, businessId);
            // Includes archived products/variants; their images must remain available.
            if (await _db.Products.AnyAsync(x => x.ImageUrl == url) ||
                await _db.ProductImages.AnyAsync(x => x.DeletedAt == null && x.ImageUrl == url) ||
                await _db.ProductVariants.AnyAsync(x => x.ImageUrl == url))
                return Ok(new { deleted = false, reason = "IMAGE_IN_USE" });
            _storage.DeleteOwnedImage(url, businessId);
            return Ok(new { deleted = true });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (IOException) { return StatusCode(500, new { message = "Could not delete the image file. Please retry." }); }
        catch (UnauthorizedAccessException) { return StatusCode(500, new { message = "Could not delete the image file. Please retry." }); }
    }

    // Customer review photo upload — public storefront. productId resolves the owning business;
    // there's no membership check here (any logged-in customer may review any product they
    // bought), same trust boundary as the original ProductReviewsController.UploadImage.
    [HttpPost("reviews/{productId:guid}/upload")]
    [Authorize(Roles = "CLIENTPAGE_CUSTOMER")]
    [EnableRateLimiting("clientpage-review")]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<IActionResult> UploadReviewImage(Guid productId, IFormFile file)
    {
        var product = await _db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId && p.DeletedAt == null);
        if (product == null)
            return NotFound(new { message = "Product not found." });

        try
        {
            var url = await _storage.SaveImageAsync(file, product.BusinessId);
            return Ok(new { url });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { code = "INVALID_FILE", message = ex.Message });
        }
    }
}
