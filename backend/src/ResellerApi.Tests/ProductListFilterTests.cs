using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class ProductListFilterTests
{
    [Theory]
    [InlineData("qty_asc", "all", "C,A,B")]
    [InlineData("qty_desc", "all", "B,A,C")]
    [InlineData("price_asc", "all", "B,C,A")]
    [InlineData("price_desc", "all", "A,C,B")]
    [InlineData("name_desc", "all", "C,B,A")]
    [InlineData("newest", "all", "C,B,A")]
    [InlineData("oldest", "all", "A,B,C")]
    [InlineData("name_asc", "low", "A")]
    [InlineData("name_asc", "in", "A,B")]
    [InlineData("name_asc", "out", "C")]
    public async Task SortsAndFiltersAvailableStockBeforePaging(string sort, string stock, string expected)
    {
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, scope);
        var category = new Category { BusinessId = scope.CurrentBusinessId, Name = "Test" };
        var branch = new Branch { Id = scope.CurrentBranchId.Value, BusinessId = scope.CurrentBusinessId, Name = "Main", Code = "MAIN" };
        var second = new Branch { BusinessId = scope.CurrentBusinessId, Name = "Other", Code = "OTHER" };
        db.AddRange(category, branch, second);
        for (var i = 0; i < 3; i++)
        {
            var p = new Product { BusinessId = scope.CurrentBusinessId, Category = category, Name = ((char)('A' + i)).ToString(), Sku = $"SKU{i}",
                SellingPrice = new[] { 300m, 100m, 200m }[i], LowStockThreshold = 5, Status = "ACTIVE", CreatedAt = new DateTime(2026, 1, 1).AddDays(i) };
            var v = new ProductVariant { BusinessId = scope.CurrentBusinessId, Product = p, Sku = $"V{i}", Barcode = $"B{i}" };
            db.Add(v);
            if (i < 2) db.BranchVariantInventories.Add(new BranchVariantInventory { Branch = branch, Variant = v, OnHand = i == 0 ? 10 : 20, Committed = 5, Damaged = 2 });
            db.BranchVariantInventories.Add(new BranchVariantInventory { Branch = second, Variant = v, OnHand = i == 2 ? 100 : 0 });
        }
        await db.SaveChangesAsync();
        // SaveChanges stamps creation times for new entities; set deterministic dates afterwards.
        foreach (var product in await db.Products.ToListAsync())
            product.CreatedAt = new DateTime(2026, 1, 1).AddDays(product.Name[0] - 'A');
        await db.SaveChangesAsync();
        var service = new ProductService(db, scope, new ActivityLogService(db), null!, new PriceSlotService(db, scope));
        var result = await service.ListAsync("ACTIVE", null, null, sort: sort, stock: stock);
        Assert.Equal(expected, string.Join(',', result.Select(p => p.Name)));
        if (result.Count > 1)
        {
            var page = await service.ListAsync("ACTIVE", null, null, skip: 1, take: 1, sort: sort, stock: stock);
            Assert.Equal(result[1].Id, Assert.Single(page).Id);
        }
        var prices = await service.ListAsync("ACTIVE", null, null, minPrice: 150, maxPrice: 250);
        Assert.Equal("C", Assert.Single(prices).Name);
        await Assert.ThrowsAsync<ArgumentException>(() => service.ListAsync(null, null, null, minPrice: 20, maxPrice: 10));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ListAsync(null, null, null, minPrice: -1));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ListAsync(null, null, null, sort: "invalid"));
        scope.CurrentBranchId = null;
        Assert.Equal("C", (await service.ListAsync("ACTIVE", null, null, take: 1, sort: "qty_desc"))[0].Name);
    }
}
