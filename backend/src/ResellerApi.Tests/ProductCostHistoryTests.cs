using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Controllers;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Tests;

public class ProductCostHistoryTests
{
    private sealed class Scope : IBusinessContext
    {
        public Guid CurrentBusinessId { get; } = Guid.NewGuid();
        public Guid? CurrentBranchId => null;
    }

    [Fact]
    public async Task RejectsOtherBusinessVariant()
    {
        var scope = new Scope();
        await using var db = Create(scope);
        var variant = new ProductVariant { BusinessId = Guid.NewGuid(), Sku = "OTHER", Barcode = "OTHER" };
        db.ProductVariants.Add(variant);
        await db.SaveChangesAsync();
        Assert.IsType<NotFoundResult>(await new ProductCostHistoryController(db, scope).Get(variant.Id));
    }

    [Fact]
    public async Task ShowsRecordedCorrectionWithoutInventingPurchaseCost()
    {
        var scope = new Scope();
        await using var db = Create(scope);
        var variant = new ProductVariant { BusinessId = scope.CurrentBusinessId, Sku = "SHOE", Barcode = "SHOE", AvgLandedCost = 250m };
        db.ProductVariants.Add(variant);
        db.ActivityLogs.Add(new ActivityLog {
            BusinessId = scope.CurrentBusinessId, EntityType = "ProductPurchaseCost", EntityId = variant.Id,
            Action = "UPDATE", User = new User { Name = "Owner" },
            BeforeJson = "{\"CostPerUnit\":200}", AfterJson = "{\"CostPerUnit\":250}"
        });
        await db.SaveChangesAsync();
        var response = Assert.IsType<OkObjectResult>(await new ProductCostHistoryController(db, scope).Get(variant.Id));
        var body = JsonSerializer.SerializeToElement(response.Value);
        Assert.Equal(250m, body.GetProperty("averageCost").GetDecimal());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("lastPurchaseCost").ValueKind);
        var row = body.GetProperty("items")[0];
        Assert.Equal(200m, row.GetProperty("PreviousCost").GetDecimal());
        Assert.Equal(250m, row.GetProperty("UnitCost").GetDecimal());
        Assert.Equal("COST_CORRECTION", row.GetProperty("Kind").GetString());
    }

    private static AppDbContext Create(Scope scope) => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString(), options => options.EnableNullChecks(false)).Options, scope);
}
