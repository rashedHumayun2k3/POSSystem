using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class OrderManagementTests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context) : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<BaseEntity>().Where(e => e.State == EntityState.Added))
                entry.Entity.RowVer ??= Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }

    private static TestDb Database(BusinessContext context) => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, context);

    private static Order NewOrder(Guid business, Guid branch, string number) => new()
    {
        BusinessId = business, BranchId = branch, OrderNo = number, Channel = "FACEBOOK",
        CustomerName = "Customer", CustomerPhone = "01700000000", IsDraft = true,
        BusinessDate = new DateOnly(2026, 9, 16), CreatedAt = new DateTime(2026, 9, 16, 10, 0, 0, DateTimeKind.Utc),
    };

    [Fact]
    public async Task AllQueue_SortsByLifecycleBeforePagination_ThenNewestDate()
    {
        var business = Guid.NewGuid();
        var branch = Guid.NewGuid();
        await using var db = Database(new BusinessContext { CurrentBusinessId = business });
        db.Branches.Add(new Branch { Id = branch, BusinessId = business, Name = "Main", Code = "MAIN" });
        for (var i = 0; i < 25; i++)
        {
            var delivered = NewOrder(business, branch, $"DELIVERED-{i}");
            delivered.IsDraft = false;
            delivered.FulfillmentStatus = "DELIVERED";
            db.Orders.Add(delivered);
        }
        var olderNew = NewOrder(business, branch, "NEW-OLDER");
        olderNew.BusinessDate = new DateOnly(2026, 9, 1);
        var newerNew = NewOrder(business, branch, "NEW-NEWER");
        var processing = NewOrder(business, branch, "PROCESSING"); processing.IsDraft = false;
        var packed = NewOrder(business, branch, "PACKED"); packed.IsDraft = false; packed.FulfillmentStatus = "PACKED";
        var transit = NewOrder(business, branch, "TRANSIT"); transit.IsDraft = false; transit.FulfillmentStatus = "IN_TRANSIT";
        var returned = NewOrder(business, branch, "RETURNED"); returned.IsDraft = false; returned.FulfillmentStatus = "RETURNED";
        var cancelled = NewOrder(business, branch, "CANCELLED"); cancelled.OrderStatus = "CANCELLED";
        db.Orders.AddRange(olderNew, newerNew, processing, packed, transit, returned, cancelled);
        await db.SaveChangesAsync();
        var service = new OrderService(db, null!, null!);
        var first = await service.ListManagementAsync("ALL", null, null, null, null, null, null, 1, false);
        Assert.Equal(new[] { "NEW-NEWER", "NEW-OLDER", "PROCESSING", "PACKED", "TRANSIT" }, first.Items.Take(5).Select(o => o.OrderNo));
        var second = await service.ListManagementAsync("ALL", null, null, null, null, null, null, 2, false);
        Assert.Equal(new[] { "RETURNED", "CANCELLED" }, second.Items.TakeLast(2).Select(o => o.OrderNo));
    }

    [Fact]
    public async Task CountsAndPagination_IncludeOlderOrders_RespectBranchAndBusiness_ExcludeCounterSales()
    {
        var business = Guid.NewGuid();
        var branch = Guid.NewGuid();
        var context = new BusinessContext { CurrentBusinessId = business, CurrentBranchId = branch };
        await using var db = Database(context);
        db.Branches.Add(new Branch { Id = branch, BusinessId = business, Name = "Main", Code = "MAIN" });
        for (var i = 0; i < 205; i++) db.Orders.Add(NewOrder(business, branch, $"ORD-{i:D3}"));
        var cancelled = NewOrder(business, branch, "CANCELLED");
        cancelled.OrderStatus = "CANCELLED";
        var shop = NewOrder(business, branch, "SHOP"); shop.Channel = "SHOP";
        var hawker = NewOrder(business, branch, "HAWKER"); hawker.Channel = "HAWKER";
        db.Orders.AddRange(cancelled, shop, hawker, NewOrder(Guid.NewGuid(), branch, "OTHER-BUSINESS"), NewOrder(business, Guid.NewGuid(), "OTHER-BRANCH"));
        await db.SaveChangesAsync();
        var service = new OrderService(db, null!, null!);
        var last = await service.ListManagementAsync("UNFULFILLED", null, null, null, null, null, null, 9, false);
        Assert.Equal(205, last.TotalCount);
        Assert.Equal(206, last.Counts["ALL"]);
        Assert.Equal(1, last.Counts["CANCELLED"]);
        Assert.Equal(5, last.Items.Count);
        Assert.All(last.Items, order => Assert.Null(order.Profit));
        var first = await service.ListManagementAsync("UNFULFILLED", null, null, null, null, null, null, 1, false);
        Assert.Empty(first.Items.Select(o => o.Id).Intersect(last.Items.Select(o => o.Id)));
        var searched = await service.ListManagementAsync("ALL", " ORD-204 ", "FACEBOOK", null, null, null, null, 1, false);
        Assert.Equal("ORD-204", Assert.Single(searched.Items).OrderNo);
        Assert.Equal(1, searched.Counts["ALL"]);
    }

    [Fact]
    public async Task Issues_UseAvailableStockAtOrderBranch_ExcludeCancelledConfirmedAndDeletedLines()
    {
        var business = Guid.NewGuid();
        var branch = new Branch { BusinessId = business, Name = "Main", Code = "MAIN" };
        var context = new BusinessContext { CurrentBusinessId = business };
        await using var db = Database(context);
        var product = new Product { BusinessId = business, Name = "Bed Sheet", Sku = "BED", ImageUrl = "/bed.jpg" };
        var variant = new ProductVariant { BusinessId = business, Product = product, Sku = "BED-1", Barcode = "BED-1" };
        db.Branches.Add(branch);
        db.ProductVariants.Add(variant);
        db.BranchVariantInventories.Add(new BranchVariantInventory { Branch = branch, Variant = variant, OnHand = 10, Committed = 7, Damaged = 1 });
        Order WithItem(string number, decimal qty)
        {
            var order = NewOrder(business, branch.Id, number);
            order.Items.Add(new OrderItem { Variant = variant, VariantId = variant.Id, Qty = qty, UnitPrice = 100 });
            return order;
        }
        var shortage = WithItem("SHORT", 3);
        var enough = WithItem("ENOUGH", 2);
        var cancelled = WithItem("CANCELLED", 3); cancelled.OrderStatus = "CANCELLED";
        var confirmed = WithItem("CONFIRMED", 3); confirmed.IsDraft = false;
        var packed = WithItem("PACKED", 3); packed.IsDraft = false; packed.FulfillmentStatus = "PACKED";
        var deleted = WithItem("DELETED", 3); deleted.Items.Single().DeletedAt = DateTime.UtcNow;
        var otherBranch = new Branch { BusinessId = business, Name = "Other", Code = "OTHER" };
        db.Branches.Add(otherBranch);
        var missingInventory = WithItem("NO-INVENTORY", 1); missingInventory.BranchId = otherBranch.Id;
        db.Orders.AddRange(shortage, enough, cancelled, confirmed, packed, deleted, missingInventory);
        await db.SaveChangesAsync();
        var service = new OrderService(db, null!, null!);
        var issues = await service.ListManagementAsync("ISSUES", null, null, null, null, null, null, 1, false);
        Assert.Equal(2, issues.TotalCount);
        Assert.Equal(2, issues.Counts["ISSUES"]);
        Assert.Equal(1, issues.Counts["PROCESSING"]);
        Assert.Equal(1, issues.Counts["WAITING_COURIER"]);
        Assert.Contains(issues.Items, o => o.OrderNo == "NO-INVENTORY");
        var item = Assert.Single(issues.Items.Single(o => o.OrderNo == "SHORT").Items);
        Assert.Equal(2, item.AvailableStock);
        Assert.Equal("/bed.jpg", item.ImageUrl);
        var filtered = await service.ListManagementAsync("ALL", null, null, "01700000000", "Bed Sheet", null, null, 1, false);
        Assert.DoesNotContain(filtered.Items, o => o.OrderNo == "DELETED");
    }
}
