using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.OwnerManagerWarehouse)]
[Route("api/v1/brands")]
public class BrandsController(AppDbContext db, IBusinessContext business) : ControllerBase
{
    public record CreateBrandRequest(string Name);

    [HttpGet]
    public async Task<IActionResult> List() => Ok(await db.Brands.AsNoTracking()
        .OrderBy(b => b.Name).Select(b => new { b.Id, b.Name }).ToListAsync());

    [HttpGet("variant/{variantId:guid}")]
    public async Task<IActionResult> ForVariant(Guid variantId)
    {
        var product = await db.ProductVariants.Where(v => v.Id == variantId)
            .Select(v => new { v.Product.BrandId, BrandName = v.Product.Brand == null ? null : v.Product.Brand.Name }).FirstOrDefaultAsync();
        return product == null ? NotFound() : Ok(product);
    }

    [HttpPost]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Create(CreateBrandRequest request)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 200)
            return BadRequest(new { message = "Brand name must contain 1 to 200 characters." });
        var existing = await db.Brands.FirstOrDefaultAsync(b => b.Name == name);
        if (existing != null) return Ok(new { existing.Id, existing.Name });
        var brand = new Brand { BusinessId = business.CurrentBusinessId, Name = name };
        db.Brands.Add(brand);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sql && (sql.Number == 2601 || sql.Number == 2627))
        { return Conflict(new { message = "This brand already exists. Refresh the brand list." }); }
        return Ok(new { brand.Id, brand.Name });
    }
}
