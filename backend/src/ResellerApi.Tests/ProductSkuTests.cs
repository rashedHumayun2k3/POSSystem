using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Tests;

public class ProductSkuTests
{
    [Fact]
    public async Task PreviewUsesBusinessSequenceWithoutCreatingProduct()
    {
        var scope = new Scope();
        await using var db = CreateDb(scope);
        var category = await AddCategory(db, scope.CurrentBusinessId);
        db.Products.AddRange(new Product { BusinessId = scope.CurrentBusinessId, Name = "Old", Sku = "SH-NIK-8", DeletedAt = DateTime.UtcNow },
            new Product { BusinessId = Guid.NewGuid(), Name = "Other", Sku = "SH-NIK-99" });
        await db.SaveChangesAsync();
        var controller = new ResellerApi.Controllers.ProductsController(null!, null!, null!, null!, null!, null!, null!, scope, null!);
        var result = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(await controller.GenerateSku(category.Id, "Nike Runner", db));
        Assert.Equal("SH-NIK-9", System.Text.Json.JsonSerializer.SerializeToElement(result.Value).GetProperty("sku").GetString());
        Assert.Equal(2, await db.Products.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task EditSkuRejectsDuplicatesAndPreservesVariantCodes()
    {
        var scope = new Scope();
        await using var db = CreateDb(scope);
        var category = await AddCategory(db, scope.CurrentBusinessId);
        var service = Service(db, scope);
        var created = await service.CreateAsync(Request(category.Id, "Nike Runner", "OLD"), Guid.NewGuid());
        var entity = await db.Products.SingleAsync(p => p.Id == created.Id);
        entity.RowVer = []; // The in-memory provider does not generate SQL rowversion values.
        var request = new UpdateProductRequest(category.Id, entity.Name, entity.ImageUrl, entity.Description, entity.DefectNotes,
            entity.UnitCode, entity.SellingPrice, entity.MarketPrice, entity.PackagingCostPerUnit, entity.LowStockThreshold,
            entity.AttributesJson, entity.Note, entity.Status, entity.RowVer, entity.WarrantyDurationValue, entity.WarrantyDurationUnit,
            entity.WholesaleMinQty, entity.WholesaleUnitPrice, entity.WholesaleNote, "NEW");
        var variants = await db.ProductVariants.Select(v => v.Sku).ToListAsync();
        Assert.Equal("NEW", (await service.UpdateAsync(entity.Id, request, Guid.NewGuid())).Sku);
        Assert.Equal(variants, await db.ProductVariants.Select(v => v.Sku).ToListAsync());
        db.Products.Add(new Product { BusinessId = scope.CurrentBusinessId, Name = "Other", Sku = "TAKEN", DeletedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateAsync(entity.Id, request with { Sku = " taken ", RowVer = entity.RowVer }, Guid.NewGuid()));
        Assert.Equal("NEW", entity.Sku);
    }

    [Theory]
    [InlineData("Shoes", "Nike Runner", "SH-NIK-")]
    [InlineData(" s-hoes", "n.i ke", "SH-NIK-")]
    [InlineData("A", "B", "AX-BXX-")]
    [InlineData("মা", "বাবা", "মাX-বাবাX-")]
    public void BuildsPrefix(string category, string name, string expected) =>
        Assert.Equal(expected, ProductSku.Prefix(category, name));

    [Fact]
    public void UsesHighestSerialIncludingManualAndMixedCaseValues() =>
        Assert.Equal("SH-NIK-13", ProductSku.Next("SH-NIK-", ["SH-NIK-1", " sh-nik-12 ", "SH-NIK-custom", "AB-NIK-50"]));

    [Fact]
    public void RejectsSerialOverflow() => Assert.Throws<ArgumentException>(() =>
        ProductSku.Next("SH-NIK-", ["SH-NIK-9223372036854775807"]));

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RejectsManualDuplicateInSameBusiness(bool archived)
    {
        var scope = new Scope();
        await using var db = CreateDb(scope);
        var category = await AddCategory(db, scope.CurrentBusinessId);
        db.Products.Add(new Product { BusinessId = scope.CurrentBusinessId, CategoryId = category.Id,
            Name = "Existing", Sku = "CUSTOM-1", DeletedAt = archived ? DateTime.UtcNow : null });
        await db.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<ArgumentException>(() => Service(db, scope)
            .CreateAsync(Request(category.Id, "Nike", " custom-1 "), Guid.NewGuid()));
        Assert.Contains("already used", error.Message);
        Assert.Equal(1, await db.Products.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task AllowsSameManualSkuInDifferentBusinesses()
    {
        var scope = new Scope();
        await using var db = CreateDb(scope);
        var category = await AddCategory(db, scope.CurrentBusinessId);
        db.Products.Add(new Product { BusinessId = Guid.NewGuid(), Name = "Other", Sku = "CUSTOM-1" });
        await db.SaveChangesAsync();
        var product = await Service(db, scope).CreateAsync(Request(category.Id, "Nike", "CUSTOM-1"), Guid.NewGuid());
        Assert.Equal("CUSTOM-1", product.Sku);
    }

    [Fact]
    public async Task AutomaticSerialIncludesArchivedProductsAndIgnoresOtherBusinesses()
    {
        var scope = new Scope();
        await using var db = CreateDb(scope);
        var category = await AddCategory(db, scope.CurrentBusinessId);
        db.Products.AddRange(
            new Product { BusinessId = scope.CurrentBusinessId, Name = "Archived", Sku = "SH-NIK-7", DeletedAt = DateTime.UtcNow },
            new Product { BusinessId = Guid.NewGuid(), Name = "Other", Sku = "SH-NIK-90" });
        await db.SaveChangesAsync();
        var service = Service(db, scope);
        Assert.Equal("SH-NIK-8", (await service.CreateAsync(Request(category.Id, "Nike Runner", null), Guid.NewGuid())).Sku);
        Assert.Equal("SH-NIK-9", (await service.CreateAsync(Request(category.Id, "Nike Shoes", " "), Guid.NewGuid())).Sku);
    }

    private sealed class Scope : IBusinessContext
    {
        public Guid CurrentBusinessId { get; } = Guid.NewGuid();
        public Guid? CurrentBranchId => null;
    }

    private sealed class Log : IActivityLogService
    {
        public Task LogAsync(Guid businessId, Guid userId, string action, string entityType,
            Guid? entityId = null, object? before = null, object? after = null) => Task.CompletedTask;
    }

    private static AppDbContext CreateDb(Scope scope) => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString(), options => options.EnableNullChecks(false)).Options, scope);

    private static ProductService Service(AppDbContext db, Scope scope) =>
        new(db, scope, new Log(), null!, new PriceSlotService(db, scope));

    private static async Task<Category> AddCategory(AppDbContext db, Guid businessId)
    {
        var category = new Category { BusinessId = businessId, Name = "Shoes" };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return category;
    }

    private static CreateProductRequest Request(Guid categoryId, string name, string? sku) =>
        new(categoryId, name, null, null, null, "pcs", 0, null, 0, 0, null, null,
            null, null, null, null, null, null, null, Sku: sku);
}
