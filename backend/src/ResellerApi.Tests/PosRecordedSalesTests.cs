using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Controllers;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Tests;

public class PosRecordedSalesTests
{
    private sealed class Scope : IBusinessContext
    {
        public Guid CurrentBusinessId { get; } = Guid.NewGuid();
        public Guid? CurrentBranchId { get; } = Guid.NewGuid();
    }
    [Fact]
    public async Task UsesSaleDateAndScopeAndCombinesRegularAndBackdatedSales()
    {
        var scope = new Scope();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, scope);
        var date = new DateOnly(2026, 11, 5);
        var product = new Product { BusinessId = scope.CurrentBusinessId, Name = "Towel", DeletedAt = DateTime.UtcNow };
        var variant = new ProductVariant { BusinessId = scope.CurrentBusinessId, ProductId = product.Id, DeletedAt = DateTime.UtcNow };
        db.Products.Add(product); db.ProductVariants.Add(variant);
        Order Sale(string source = "POS") => new() { BusinessId = scope.CurrentBusinessId,
            BranchId = scope.CurrentBranchId, BusinessDate = date, Source = source, Channel = "SHOP",
            OrderNo = Guid.NewGuid().ToString(), CustomerName = "Walk-in", PaymentStatus = "PAID",
            CreatedAt = new DateTime(2026, 11, 6, 12, 0, 0, DateTimeKind.Utc),
            Items = [new OrderItem { VariantId = variant.Id, Qty = 2, UnitPrice = 100 }],
            Payments = [new OrderPayment { Method = "BKASH", Amount = 200 }] };
        var first = Sale(); var legacy = Sale("MANUAL");
        legacy.Items.Add(new OrderItem { VariantId = variant.Id, Qty = 99, UnitPrice = 100, DeletedAt = DateTime.UtcNow });
        var otherDate = Sale(); otherDate.BusinessDate = date.AddDays(-1);
        var tenant = Sale(); tenant.BusinessId = Guid.NewGuid();
        var branch = Sale(); branch.BranchId = Guid.NewGuid();
        var draft = Sale(); draft.IsDraft = true;
        var cancelled = Sale(); cancelled.OrderStatus = "CANCELLED";
        var returned = Sale(); returned.FulfillmentStatus = "RETURNED";
        var unpaid = Sale(); unpaid.PaymentStatus = "UNPAID";
        var online = Sale("MANUAL"); online.Channel = "FACEBOOK";
        db.Orders.AddRange(first, legacy, otherDate, tenant, branch, draft, cancelled, returned, unpaid, online);
        await db.SaveChangesAsync();
        var response = Assert.IsType<OkObjectResult>(await new PosRecordedSalesController(db).Get(date));
        var report = Assert.IsType<PosRecordedSalesController.RecordedReport>(response.Value);
        Assert.Equal(2, report.SaleCount);
        Assert.Equal(4m, report.Qty); Assert.Equal(400m, report.Amount);
        Assert.Equal("Towel", Assert.Single(report.Products).Name);
        Assert.All(report.Sales, s => Assert.Equal("BKASH", Assert.Single(s.PaymentMethods)));
        Assert.IsType<BadRequestObjectResult>(await new PosRecordedSalesController(db).Get(default));
    }
}
