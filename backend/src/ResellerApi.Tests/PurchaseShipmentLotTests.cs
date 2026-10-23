using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ResellerApi.Data;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Tests;

public class PurchaseShipmentLotTests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context) : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            foreach (var e in ChangeTracker.Entries<BaseEntity>().Where(e => e.State == EntityState.Added)) e.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(ct);
        }
    }
    private sealed class Log : IActivityLogService
    {
        public Task LogAsync(Guid businessId, Guid userId, string action, string entityType, Guid? entityId = null, object? before = null, object? after = null) => Task.CompletedTask;
    }
    private sealed class Fixture : IAsyncDisposable
    {
        public BusinessContext Context = new() { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        public TestDb Db;
        public PurchaseTripService Service;
        public PurchaseTrip Trip;
        public PurchaseItem Item;
        public Guid UserId = Guid.NewGuid();
        public Fixture()
        {
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Context);
            Service = new(Db, Context, new Log(), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Purchases:WeightTolerancePercent"] = "5" }).Build());
            var product = new Product { BusinessId = Context.CurrentBusinessId, Name = "Shoes", Sku = "SHOE" };
            var variant = new ProductVariant { BusinessId = Context.CurrentBusinessId, Product = product, Sku = "SHOE-42", Barcode = "123" };
            Trip = new() { BusinessId = Context.CurrentBusinessId, BranchId = Context.CurrentBranchId, TripNo = "PO-TEST", SourceType = "CHINA_TRIP", Status = "PRODUCT_APPROVED", CreatedBy = UserId };
            Item = new() { Trip = Trip, Variant = variant, QtyBought = 10, TotalCost = 1000 };
            Trip.Items.Add(Item);
            Db.Users.Add(new User { Id = UserId, Name = "Owner", Phone = "123", Role = "OWNER", PasswordHash = "test" });
            Db.PurchaseTrips.Add(Trip);
        }
        public Task Seed() => Db.SaveChangesAsync();
        public async Task<PurchaseLotDto> Lot(string no, decimal qty, decimal courier = 0)
        {
            var lot = await Service.SaveLotAsync(Trip.Id, null, new(no, qty * 100, [new(Item.Id, qty)]), UserId);
            await Service.AddCostAsync(Trip.Id, new("COURIER", courier, null, null, null, lot.Id), UserId);
            await Service.SendLotAsync(Trip.Id, lot.Id, new(), UserId);
            return lot;
        }
        public Task<PurchaseTripDetailDto> Receive(PurchaseLotDto lot, decimal usable, decimal missing = 0, bool owner = true, decimal damaged = 0) =>
            Service.CreateReceiveSessionAsync(Trip.Id, new(DateTime.UtcNow, "COURIER", null, null,
                [new(Item.Id, usable, damaged, "{}", missing, (usable + damaged) * 100)], ShipmentId: lot.Id, BilledWeightGrams: lot.DeclaredWeightGrams), UserId, owner);
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    [Theory]
    [InlineData("TRANSPORT")]
    [InlineData("LABOR")]
    [InlineData("CUSTOMS")]
    [InlineData("SHIPPING_INTL")]
    [InlineData("AGENT_FEE")]
    [InlineData("PAYMENT_FEE")]
    [InlineData("CURRENCY_LOSS")]
    [InlineData("OTHER")]
    public async Task AdditionalCategoriesCanBeAssignedToLotAndIncludedInLandedCost(string category)
    {
        await using var f = new Fixture(); await f.Seed();
        var lot = await f.Lot("LOT-1", 10, 0);
        var cost = await f.Service.AddCostAsync(f.Trip.Id, new(category, 100, null, null, null, lot.Id), f.UserId);
        Assert.Equal(lot.Id, cost.ShipmentId);
        await f.Receive(lot, 10);
        Assert.Equal(110, f.Item.LandedUnitCost);
    }

    [Fact]
    public async Task PurchaseBrandIsStoredOnCatalogProductAndPreservedWhenOmitted()
    {
        await using var f = new Fixture();
        f.Trip.Status = "DRAFT";
        var brand = new Brand { BusinessId = f.Context.CurrentBusinessId, Name = "Test Brand" };
        f.Db.Brands.Add(brand); await f.Seed();
        await f.Service.UpdateItemAsync(f.Trip.Id, f.Item.Id, new(10, 1000, null, null, 0, 1000, null, BrandId: brand.Id), f.UserId);
        Assert.Equal(brand.Id, f.Item.Variant.Product.BrandId);
        await f.Service.UpdateItemAsync(f.Trip.Id, f.Item.Id, new(10, 1000, null, null, 0, 1000, null), f.UserId);
        Assert.Equal(brand.Id, f.Item.Variant.Product.BrandId);
    }

    [Fact]
    public async Task PurchaseCannotAssignAnotherBusinessBrand()
    {
        await using var f = new Fixture(); f.Trip.Status = "DRAFT";
        var foreign = new Brand { BusinessId = Guid.NewGuid(), Name = "Other business" };
        f.Db.Brands.Add(foreign); await f.Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => f.Service.UpdateItemAsync(f.Trip.Id, f.Item.Id,
            new(10, 1000, null, null, 0, 1000, null, BrandId: foreign.Id), f.UserId));
        Assert.Null(f.Item.Variant.Product.BrandId);
    }

    [Fact]
    public async Task SplitFourAndSixUpdatesStockOnceAndCompletesOnlyAfterBothLots()
    {
        await using var f = new Fixture(); await f.Seed();
        var first = await f.Lot("LOT-1", 4, 40);
        var second = await f.Lot("LOT-2", 6, 60);
        Assert.Equal(10, f.Item.QtyShipped);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.SaveLotAsync(f.Trip.Id, null, new("OVER", 100, [new(f.Item.Id, 1)]), f.UserId));
        var partial = await f.Receive(first, 4);
        Assert.Equal("IN_PROGRESS", partial.Status);
        Assert.Equal(110, f.Item.LandedUnitCost);
        Assert.Equal(4, (await f.Db.BranchVariantInventories.SingleAsync()).OnHand);
        var completed = await f.Receive(second, 6);
        Assert.Equal("COMPLETED", completed.Status);
        Assert.Equal(10, f.Item.QtyUsable);
        Assert.Equal(110, f.Item.LandedUnitCost);
        Assert.Equal(1100, f.Db.Lots.Sum(l => l.QtyIn * l.LandedUnitCost));
        Assert.Equal(100, f.Item.Variant.UnitWeightGrams);
        Assert.All(completed.Lots!, lot => Assert.Equal("RECEIVED", lot.Status));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.ApproveSessionAsync(f.Trip.Id, completed.Sessions[0].Id, f.UserId));
    }

    [Fact]
    public async Task WarehouseReceiptWaitsForApprovalAndRejectAllowsReplacement()
    {
        await using var f = new Fixture(); await f.Seed(); var lot = await f.Lot("LOT-1", 10);
        var pending = await f.Receive(lot, 10, owner: false);
        Assert.Empty(f.Db.Lots); Assert.Equal(0, f.Item.QtyUsable);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Receive(lot, 10));
        var sessionId = pending.Sessions.Single().Id;
        await f.Service.RejectSessionAsync(f.Trip.Id, sessionId, "Recount", f.UserId);
        var replacement = await f.Receive(lot, 10, owner: false);
        await f.Service.ApproveSessionAsync(f.Trip.Id, replacement.Sessions.Single(s => s.Status == "PENDING_APPROVAL").Id, f.UserId);
        Assert.Equal(10, f.Item.QtyUsable);
        Assert.Single(f.Db.Lots);
    }

    [Fact]
    public async Task MissingPurchaseValueBecomesLossAndDoesNotInflateUsableCost()
    {
        await using var f = new Fixture(); await f.Seed(); var lot = await f.Lot("LOT-1", 10, 80);
        var result = await f.Receive(lot, 8, missing: 2);
        var line = result.Sessions.Single().Items.Single();
        Assert.Equal(200, line.LossAmount); Assert.Equal(80, line.AllocatedShippingCost);
        Assert.Equal(110, f.Item.LandedUnitCost); Assert.Equal(8, (await f.Db.BranchVariantInventories.SingleAsync()).OnHand);
        Assert.Equal("COMPLETED", result.Status);
        Assert.NotEmpty(result.Lots!.Single().WeightWarnings);
    }

    [Fact]
    public async Task CourierRowIsRequiredAndDraftReceiptIsBlocked()
    {
        await using var f = new Fixture(); await f.Seed();
        var lot = await f.Service.SaveLotAsync(f.Trip.Id, null, new("ONE", 1000, [new(f.Item.Id, 10)]), f.UserId);
        await f.Service.SendLotAsync(f.Trip.Id, lot.Id, new(), f.UserId);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Receive(lot, 10));
        Assert.Empty(f.Db.PurchaseReceiveSessions);
        f.Trip.Status = "DRAFT"; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Receive(lot, 10));
    }

    [Fact]
    public async Task ApprovalRequiresOnlyProductAndCommonPayments()
    {
        await using var f = new Fixture(); f.Trip.Status = "DRAFT"; await f.Seed();
        var common = new PurchaseTripCost { TripId = f.Trip.Id, CostType = "AGENT_FEE", Amount = 100 };
        var lotCost = new PurchaseTripCost { TripId = f.Trip.Id, ShipmentId = Guid.NewGuid(), CostType = "COURIER", Amount = 300 };
        f.Db.PurchaseTripCosts.AddRange(common, lotCost); await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.ApproveAsync(f.Trip.Id, null, f.UserId));
        foreach (var (key, amount) in new[] { (Guid.Empty, 1000m), (common.Id, 100m) })
            f.Db.PurchasePayments.Add(new PurchasePayment { BusinessId = f.Context.CurrentBusinessId, BranchId = f.Context.CurrentBranchId,
                TripId = f.Trip.Id, CostKey = key, Amount = amount, FundingSource = "BUSINESS", RequestId = Guid.NewGuid() });
        await f.Db.SaveChangesAsync();
        Assert.Equal("PRODUCT_APPROVED", (await f.Service.ApproveAsync(f.Trip.Id, null, f.UserId)).Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.AddCostAsync(f.Trip.Id, new("OTHER", 20, null, null, null), f.UserId));
    }

    [Fact]
    public async Task LegacyPartialReceiptsUseSessionQuantityAndRemainCompletable()
    {
        await using var f = new Fixture(); f.Trip.UsesShipmentLots = false; f.Trip.Status = "IN_PROGRESS";
        f.Item.QtyBought = 100; f.Item.TotalCost = 10000; await f.Seed();
        var request = new CreateReceiveSessionRequest(DateTime.UtcNow, "TRUCK", null, null, [new(f.Item.Id, 50, 0, "{}")]);
        await f.Service.CreateReceiveSessionAsync(f.Trip.Id, request, f.UserId, true);
        var result = await f.Service.CreateReceiveSessionAsync(f.Trip.Id, request, f.UserId, true);
        Assert.Equal(100, f.Item.LandedUnitCost);
        Assert.Equal(10000, f.Db.Lots.Sum(l => l.QtyIn * l.LandedUnitCost));
        Assert.Equal("COMPLETED", result.Status);
    }

    [Fact]
    public async Task ClosingRequiresPendingDecisionsAndReasonForUnaccountedQuantity()
    {
        await using var f = new Fixture(); await f.Seed(); var lot = await f.Lot("ONE", 4);
        var pending = await f.Receive(lot, 4, owner: false);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.CloseTripAsync(f.Trip.Id, "Missing remainder", f.UserId));
        await f.Service.ApproveSessionAsync(f.Trip.Id, pending.Sessions.Single().Id, f.UserId);
        await Assert.ThrowsAsync<UnaccountedUnitsException>(() => f.Service.CloseTripAsync(f.Trip.Id, null, f.UserId));
        Assert.Equal("COMPLETED", (await f.Service.CloseTripAsync(f.Trip.Id, "Supplier cannot fulfil remainder", f.UserId)).Status);
    }

    [Fact]
    public void WeightAllocationIncludesOnlyThisLotsValueShareOfCommonCosts()
    {
        var a = new PurchaseItem { QtyBought = 10, TotalCost = 1000 };
        var b = new PurchaseItem { QtyBought = 10, TotalCost = 1000 };
        var rows = new[] {
            new PurchaseReceiveItem { PurchaseItemId = a.Id, QtyUsable = 4, MeasuredWeightGrams = 100 },
            new PurchaseReceiveItem { PurchaseItemId = b.Id, QtyUsable = 4, MeasuredWeightGrams = 300 } };
        var costs = PurchaseLotCosting.Allocate([a, b], rows, 200, 120, true); // 80 common + 120 lot.
        Assert.Equal(50, costs[0].AllocatedCost); Assert.Equal(150, costs[1].AllocatedCost);
        Assert.Equal(112.50m, costs[0].LandedUnitCost); Assert.Equal(137.50m, costs[1].LandedUnitCost);
    }

    [Fact]
    public void AllMissingOrDamagedLotRecordsUnrecoverableCostsWithoutDivisionByZero()
    {
        var item = new PurchaseItem { QtyBought = 10, TotalCost = 1000 };
        var loss = PurchaseLotCosting.Allocate([item], [new PurchaseReceiveItem { PurchaseItemId = item.Id, QtyMissing = 10 }], 100, 200, true).Single();
        Assert.Equal(1300, loss.LossAmount); Assert.Equal(0, loss.LandedUnitCost);
        var damaged = PurchaseLotCosting.Allocate([item], [new PurchaseReceiveItem { PurchaseItemId = item.Id, QtyDamaged = 10, MeasuredWeightGrams = 100 }], 100, 200, true).Single();
        Assert.Equal(1300, damaged.LossAmount);
    }

    [Fact]
    public void WeightToleranceIsConfigurable()
    {
        Assert.NotEmpty(PurchaseLotCosting.WeightWarnings(100, 106, 100, 5));
        Assert.Empty(PurchaseLotCosting.WeightWarnings(100, 106, 100, 10));
    }

    [Fact]
    public async Task ExcelPreviewFindsUnknownAndOverallocatedRowsWithoutWriting()
    {
        await using var f = new Fixture(); await f.Seed();
        using var book = new XLWorkbook(); var sheet = book.AddWorksheet("Lot");
        sheet.Cell(1,1).Value = "Variant"; sheet.Cell(1,2).Value = "Qty";
        sheet.Cell(2,1).Value = "SHOE-42"; sheet.Cell(2,2).Value = 4;
        sheet.Cell(3,1).Value = "SHOE-42"; sheet.Cell(3,2).Value = 7;
        sheet.Cell(4,1).Value = "UNKNOWN"; sheet.Cell(4,2).Value = 1;
        using var stream = new MemoryStream(); book.SaveAs(stream);
        var preview = await f.Service.PreviewLotImportAsync(f.Trip.Id, new("lot.xlsx", Convert.ToBase64String(stream.ToArray())));
        Assert.False(preview.Valid); Assert.Null(preview.Rows[0].Error);
        Assert.Contains("remaining", preview.Rows[1].Error!); Assert.Contains("Unknown", preview.Rows[2].Error!);
        Assert.Empty(f.Db.PurchaseShipments);
    }

    [Fact]
    public async Task ReceiptPersistsAcrossRequestsAndReusesMeasuredWeightOnNextPurchase()
    {
        await using var f = new Fixture(); await f.Seed(); var lot = await f.Lot("ONE", 10);
        var variantId = f.Item.VariantId;
        f.Db.ChangeTracker.Clear();
        await f.Receive(lot, 10);
        f.Db.ChangeTracker.Clear();
        Assert.Equal(100, (await f.Db.ProductVariants.SingleAsync(v => v.Id == variantId)).UnitWeightGrams);
        var next = new PurchaseTrip { BusinessId = f.Context.CurrentBusinessId, BranchId = f.Context.CurrentBranchId,
            TripNo = "PO-NEXT", SourceType = "CHINA_TRIP", CreatedBy = f.UserId };
        f.Db.PurchaseTrips.Add(next); await f.Db.SaveChangesAsync();
        var item = await f.Service.AddItemAsync(next.Id, new(variantId, 2, 200, null, null, 0, 200, null), f.UserId);
        Assert.Equal(100, item.UnitWeightGrams);
    }

    [Fact]
    public async Task PendingReceiptIsValidatedAgainAndReceivedLotCostsAreLocked()
    {
        await using var f = new Fixture(); await f.Seed(); var lot = await f.Lot("ONE", 10, 100);
        var pending = await f.Receive(lot, 10, owner: false);
        f.Item.QtyUsable = 1; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<ArgumentException>(() => f.Service.ApproveSessionAsync(f.Trip.Id, pending.Sessions.Single().Id, f.UserId));
        f.Item.QtyUsable = 0; await f.Db.SaveChangesAsync();
        await f.Service.ApproveSessionAsync(f.Trip.Id, pending.Sessions.Single().Id, f.UserId);
        var cost = await f.Db.PurchaseTripCosts.SingleAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.RemoveCostAsync(f.Trip.Id, cost.Id, f.UserId));
        var late = await f.Service.AddCostAsync(f.Trip.Id, new("COURIER", 25, "Late bill", null, null, lot.Id), f.UserId);
        Assert.True(late.IsPostCompletion);
        Assert.Equal(110, f.Item.LandedUnitCost);
    }

    [Fact]
    public async Task DraftAndCrossTenantLotOperationsAreRejected()
    {
        await using var f = new Fixture(); f.Trip.Status = "DRAFT"; await f.Seed();
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.SaveLotAsync(f.Trip.Id, null, new("ONE", 100, [new(f.Item.Id, 1)]), f.UserId));
        f.Trip.Status = "PRODUCT_APPROVED"; await f.Db.SaveChangesAsync(); var lot = await f.Lot("ONE", 10);
        f.Context.CurrentBusinessId = Guid.NewGuid();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Receive(lot, 10));
        Assert.Empty(f.Db.Lots);
    }

    [Fact]
    public void AllocationRoundingPreservesEveryPaisa()
    {
        var products = Enumerable.Range(0, 3).Select(_ => new PurchaseItem { QtyBought = 1, TotalCost = 1 }).ToList();
        var rows = products.Select(p => new PurchaseReceiveItem { PurchaseItemId = p.Id, QtyUsable = 1, MeasuredWeightGrams = 1 }).ToList();
        Assert.Equal(1m, PurchaseLotCosting.Allocate(products, rows, 0, 1, true).Sum(c => c.AllocatedCost));
    }
}
