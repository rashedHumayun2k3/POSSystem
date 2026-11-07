using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class ClientPageVisibilityTests
{
    [Fact]
    public async Task ShopHidesDisabledProductsFromDetailsListingsAndRelatedProducts()
    {
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, scope);
        var category = new Category { BusinessId = scope.CurrentBusinessId, Name = "Test" };
        var visible = new Product { BusinessId = scope.CurrentBusinessId, Category = category,
            Name = "Visible", Sku = "VISIBLE", Status = "ACTIVE", ShowOnMarketplace = true,
            ImageUrl = "/visible.jpg", SellingPrice = 100 };
        var hidden = new Product { BusinessId = scope.CurrentBusinessId, Category = category,
            Name = "Hidden", Sku = "HIDDEN", Status = "ACTIVE", ShowOnMarketplace = false,
            ImageUrl = "/hidden.jpg", SellingPrice = 100 };
        db.AddRange(
            new ProductVariant { BusinessId = scope.CurrentBusinessId, Product = visible, Sku = "V1", Barcode = "B1" },
            new ProductVariant { BusinessId = scope.CurrentBusinessId, Product = hidden, Sku = "V2", Barcode = "B2" });
        await db.SaveChangesAsync();
        var products = new ProductService(db, scope, new ActivityLogService(db), null!, new PriceSlotService(db, scope));
        var service = new ClientPageCatalogService(db, products);
        var shop = new ClientPageShopContext { IsShopMode = true, BusinessId = scope.CurrentBusinessId, ShopName = "Test" };

        Assert.Null(await service.GetProductDetailAsync(shop, hidden.Id));
        Assert.NotNull(await service.GetProductDetailAsync(shop, visible.Id));
        var listing = await service.SearchAsync(shop, null, null, false);
        Assert.Equal(visible.Id, Assert.Single(listing.Items).ProductId);
        Assert.Equal(1, listing.Total);
        Assert.Empty(await service.GetRelatedProductsAsync(shop, visible.Id));

        visible.ShowOnMarketplace = false;
        await db.SaveChangesAsync();
        Assert.Null(await service.GetProductDetailAsync(shop, visible.Id));
        Assert.Empty((await service.SearchAsync(shop, null, null, false)).Items);
    }
}
