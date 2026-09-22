using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

public class InvoiceListTests
{
    private class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context)
        : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<BaseEntity>().Where(e => e.State == EntityState.Added))
                entry.Entity.RowVer ??= Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }

    [Fact]
    public async Task Search_PaginatesBeyond200_AndExcludesIneligibleAndOtherBusinessOrders()
    {
        var businessId = Guid.NewGuid();
        var context = new BusinessContext { CurrentBusinessId = businessId };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, context);
        for (var i = 0; i < 205; i++)
            db.Orders.Add(NewOrder(businessId, $"ORD-TEST-{i:D3}"));
        var draft = NewOrder(businessId, "ORD-TEST-DRAFT");
        draft.IsDraft = true;
        var cancelled = NewOrder(businessId, "ORD-TEST-CANCELLED");
        cancelled.OrderStatus = "CANCELLED";
        db.Orders.AddRange(draft, cancelled, NewOrder(Guid.NewGuid(), "ORD-TEST-OTHER"));
        await db.SaveChangesAsync();

        var service = new OrderService(db, null!, null!);
        var lastPage = await service.ListInvoicesAsync(" test- ", 11, 20);
        Assert.Equal(205, lastPage.TotalCount);
        Assert.Equal(5, lastPage.Items.Count);
        var exact = await service.ListInvoicesAsync("test-204", 1, 20);
        Assert.Equal("ORD-TEST-204", Assert.Single(exact.Items).OrderNo);
        var empty = await service.ListInvoicesAsync("missing", 1, 20);
        Assert.Empty(empty.Items);
    }

    [Fact]
    public async Task FiltersAndSummary_UseFinancialsBeforePagination_AndDoNotNetCreditsAgainstDue()
    {
        var businessId = Guid.NewGuid();
        var context = new BusinessContext { CurrentBusinessId = businessId };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, context);
        var paid = NewOrder(businessId, "PAID");
        paid.Items.Add(new OrderItem { BusinessId = businessId, Qty = 1, UnitPrice = 100 });
        paid.Payments.Add(new OrderPayment { BusinessId = businessId, Amount = 150, Method = "CASH" });
        var due = NewOrder(businessId, "DUE");
        due.Items.Add(new OrderItem { BusinessId = businessId, Qty = 2, UnitPrice = 100 });
        due.DiscountType = "PERCENT";
        due.DiscountValue = 10;
        due.DeliveryChargeCustomer = 20;
        due.Payments.Add(new OrderPayment { BusinessId = businessId, Amount = 50, Method = "CASH" });
        due.Payments.Add(new OrderPayment { BusinessId = businessId, Amount = 900, Method = "CASH", DeletedAt = DateTime.UtcNow });
        var yesterday = NewOrder(businessId, "OLD");
        yesterday.BusinessDate = due.BusinessDate.AddDays(-1);
        yesterday.Items.Add(new OrderItem { BusinessId = businessId, Qty = 1, UnitPrice = 999 });
        db.Orders.AddRange(paid, due, yesterday);
        await db.SaveChangesAsync();
        var service = new OrderService(db, null!, null!);
        var result = await service.ListInvoicesAsync(null, 1, 1, due.BusinessDate, due.BusinessDate, "due", due.BusinessDate);
        Assert.Equal("DUE", Assert.Single(result.Items).OrderNo);
        Assert.Equal(1, result.TotalCount);
        Assert.Equal(300m, result.Summary.Total);
        Assert.Equal(200m, result.Summary.Paid);
        Assert.Equal(150m, result.Summary.Due);
        var paidOnly = await service.ListInvoicesAsync(null, 1, 20, payment: "paid", today: due.BusinessDate);
        Assert.Equal("PAID", Assert.Single(paidOnly.Items).OrderNo);
        var searched = await service.ListInvoicesAsync("missing", 1, 20, today: due.BusinessDate);
        Assert.Empty(searched.Items);
        Assert.Equal(result.Summary, searched.Summary);
        await Assert.ThrowsAsync<ArgumentException>(() => service.ListInvoicesAsync(null, 1, 20, due.BusinessDate, yesterday.BusinessDate));
    }

    [Theory]
    [InlineData("SHOP")]
    [InlineData("HAWKER")]
    [InlineData("FACEBOOK")]
    public async Task InvoiceEndpoint_UsesA4_ForEveryChannel(string channel)
    {
        var context = new BusinessContext();
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, context);
        var company = new Company { Name = "Test Company" };
        var business = new Business { CompanyId = company.Id, Name = "Test Store", Currency = "BDT" };
        var owner = new User { CompanyId = company.Id, Name = "Owner", Phone = "01700000000", PasswordHash = "x", Role = "OWNER" };
        db.Companies.Add(company);
        db.Businesses.Add(business);
        db.Users.Add(owner);
        var order = NewOrder(business.Id, "ORD-A4-TEST");
        order.Channel = channel;
        order.CreatedBy = owner.Id;
        order.CreatedByUser = owner;
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        context.CurrentBusinessId = business.Id;

        var service = new OrderService(db, null!, null!);
        var invoice = System.Text.Encoding.ASCII.GetString(await service.GetInvoicePdfAsync(order.Id));
        Assert.Contains("/MediaBox [0 0 595 842]", invoice);
        var preview = await service.GetInvoicePreviewAsync(order.Id);
        Assert.Equal(order.OrderNo, preview.OrderNo);
        Assert.Equal(order.CustomerName, preview.CustomerName);
        var previewPage = Assert.Single(preview.Pages);
        Assert.StartsWith("data:image/png;base64,", previewPage);
        using var bitmap = SkiaSharp.SKBitmap.Decode(Convert.FromBase64String(previewPage.Split(',')[1]));
        Assert.Equal(1190, bitmap.Width);
        Assert.Equal(1684, bitmap.Height);
        if (channel is "SHOP" or "HAWKER")
        {
            var receipt = System.Text.Encoding.ASCII.GetString(await service.GetReceiptPdfAsync(order.Id));
            Assert.Contains("/MediaBox [0 0 226 ", receipt);
        }
    }

    private static Order NewOrder(Guid businessId, string number) => new()
    {
        BusinessId = businessId, BranchId = Guid.NewGuid(), OrderNo = number, Channel = "SHOP",
        CustomerName = "Customer", CustomerPhone = "", BusinessDate = new DateOnly(2026, 9, 12),
    };
}
