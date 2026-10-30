using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/products/{productId:guid}/brand")]
public class ProductBrandController(AppDbContext db, IActivityLogService log, ICurrentUserService user) : ControllerBase
{
    public record SetBrandRequest(Guid? BrandId);

    [HttpGet("/api/v1/products/brand-options")]
    public async Task<IActionResult> Options() => Ok(await db.Brands.AsNoTracking()
        .OrderBy(b => b.Name).Select(b => new { b.Id, b.Name }).ToListAsync());

    [HttpGet]
    public async Task<IActionResult> Get(Guid productId)
    {
        var product = await db.Products.AsNoTracking().Where(p => p.Id == productId)
            .Select(p => new { p.BrandId, BrandName = p.Brand == null ? null : p.Brand.Name }).FirstOrDefaultAsync();
        return product == null ? NotFound() : Ok(product);
    }

    [HttpPatch]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Set(Guid productId, SetBrandRequest request)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId);
        if (product == null) return NotFound();
        if (request.BrandId.HasValue && !await db.Brands.AnyAsync(b => b.Id == request.BrandId.Value))
            return BadRequest(new { message = "Select an available brand from this business." });
        var previous = product.BrandId;
        product.BrandId = request.BrandId;
        await db.SaveChangesAsync();
        await log.LogAsync(product.BusinessId, user.UserId, "UPDATE", "ProductBrand", product.Id,
            before: new { BrandId = previous }, after: new { product.BrandId });
        return await Get(productId);
    }
}
