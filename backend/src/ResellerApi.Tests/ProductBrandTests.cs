using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Controllers;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class ProductBrandTests
{
    [Fact]
    public async Task BrandFilterCombinesWithSearchStatusCategoryAndPagination()
    {
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, scope);
        var category = new Category { BusinessId = scope.CurrentBusinessId, Name = "Shoes" };
        var brand = new Brand { BusinessId = scope.CurrentBusinessId, Name = "Brand" };
        db.AddRange(category, brand);
        foreach (var (name, brandId, businessId, status) in new[] {
            ("Shoe A", (Guid?)null, scope.CurrentBusinessId, "ACTIVE"),
            ("Shoe B", (Guid?)brand.Id, scope.CurrentBusinessId, "ACTIVE"),
            ("Shoe C", (Guid?)brand.Id, scope.CurrentBusinessId, "ACTIVE"),
            ("Shoe D", (Guid?)brand.Id, scope.CurrentBusinessId, "INACTIVE"),
            ("Shoe E", (Guid?)brand.Id, Guid.NewGuid(), "ACTIVE") })
            db.Products.Add(new Product { BusinessId = businessId, CategoryId = category.Id, BrandId = brandId, Name = name, Sku = name, Status = status });
        await db.SaveChangesAsync();
        var service = new ProductService(db, scope, new ActivityLogService(db), null!, new PriceSlotService(db, scope));
        var page = await service.ListAsync("ACTIVE", category.Id, "Shoe", 1, 1, brand.Id);
        Assert.Equal("Shoe C", Assert.Single(page).Name);
        Assert.Empty(await service.ListAsync("ACTIVE", category.Id, "Shoe", brandId: Guid.NewGuid()));
        Assert.Equal(3, (await service.ListAsync("ACTIVE", category.Id, "Shoe")).Count);
    }

    [Fact]
    public async Task SavesAndClearsBrandAndRejectsOtherBusiness()
    {
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, scope);
        var product = new Product { BusinessId = scope.CurrentBusinessId, Name = "Test", Sku = "TEST" };
        var brand = new Brand { BusinessId = scope.CurrentBusinessId, Name = "Brand" };
        var other = new Brand { BusinessId = Guid.NewGuid(), Name = "Other" };
        var otherProduct = new Product { BusinessId = other.BusinessId, Name = "Other", Sku = "OTHER" };
        db.AddRange(product, brand, other, otherProduct);
        await db.SaveChangesAsync();
        var controller = new ProductBrandController(db, new ActivityLogService(db), new CurrentUserService(new HttpContextAccessor()));
        Assert.IsType<BadRequestObjectResult>(await controller.Set(product.Id, new(other.Id)));
        Assert.Null(product.BrandId);
        Assert.IsType<NotFoundResult>(await controller.Set(otherProduct.Id, new(brand.Id)));
        Assert.IsType<NotFoundResult>(await controller.Get(otherProduct.Id));
        Assert.IsType<OkObjectResult>(await controller.Set(product.Id, new(brand.Id)));
        Assert.Equal(brand.Id, (await db.Products.AsNoTracking().SingleAsync()).BrandId);
        Assert.IsType<OkObjectResult>(await controller.Set(product.Id, new(null)));
        Assert.Null((await db.Products.AsNoTracking().SingleAsync()).BrandId);
        brand.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        Assert.IsType<BadRequestObjectResult>(await controller.Set(product.Id, new(brand.Id)));
    }
}
