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

    [Fact]
    public async Task ExcludesOpeningStockButKeepsActualPurchases()
    {
        var scope = new Scope();
        await using var db = Create(scope);
        var variant = new ProductVariant { BusinessId = scope.CurrentBusinessId, Sku = "TEST", Barcode = "TEST", AvgLandedCost = 421 };
        db.ProductVariants.Add(variant);
        var branch = new Branch { BusinessId = scope.CurrentBusinessId, Name = "Main", Code = "MAIN" };
        foreach (var source in new[] { "OPENING_BALANCE", "LOCAL" })
        {
            var trip = new PurchaseTrip { BusinessId = scope.CurrentBusinessId, SourceType = source, TripNo = source };
            var item = new PurchaseItem { Trip = trip, Variant = variant };
            var lot = new Lot { BusinessId = scope.CurrentBusinessId, Variant = variant, PurchaseItem = item, LandedUnitCost = source == "LOCAL" ? 500 : 421 };
            db.StockMovements.Add(new StockMovement { BusinessId = scope.CurrentBusinessId, VariantId = variant.Id,
                MovementType = "PURCHASE_IN", Branch = branch, Lot = lot, Qty = 10, User = new User { Name = "Owner" } });
        }
        db.StockMovements.Add(new StockMovement { BusinessId = scope.CurrentBusinessId, VariantId = variant.Id,
            MovementType = "ADJUSTMENT", ReferenceType = "ExistingStockCost", Qty = 5, User = new User { Name = "Owner" } });
        await db.SaveChangesAsync();
        var response = Assert.IsType<OkObjectResult>(await new ProductCostHistoryController(db, scope).Get(variant.Id));
        var body = JsonSerializer.SerializeToElement(response.Value);
        Assert.Equal(1, body.GetProperty("totalCount").GetInt32());
        Assert.Equal(500m, body.GetProperty("lastPurchaseCost").GetDecimal());
        Assert.Equal("LOCAL", body.GetProperty("items")[0].GetProperty("PurchaseNo").GetString());
        Assert.Equal(421m, body.GetProperty("averageCost").GetDecimal());
        Assert.Equal(3, await db.StockMovements.CountAsync());
    }

    private static AppDbContext Create(Scope scope) => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString(), options => options.EnableNullChecks(false)).Options, scope);
}
