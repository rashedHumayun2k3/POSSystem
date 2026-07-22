using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using ResellerApi.Data;
using ResellerApi.DTOs.Orders;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

public class CustomerServiceTests
{
    private class TestAppDbContext(DbContextOptions<AppDbContext> options, IBusinessContext businessContext)
        : AppDbContext(options, businessContext)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<BaseEntity>())
            {
                if (entry.State == EntityState.Added && entry.Entity.RowVer is null)
                    entry.Entity.RowVer = Guid.NewGuid().ToByteArray();
            }
            return base.SaveChangesAsync(cancellationToken);
        }
    }

    private static (AppDbContext Db, BusinessContext BizContext) NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var bizContext = new BusinessContext();
        return (new TestAppDbContext(options, bizContext), bizContext);
    }

    private static CustomerService NewService(AppDbContext db) => new(db);

    private static async Task<(Business Business, Branch Branch, User Owner, Customer Customer)> SeedCustomerAsync(
        AppDbContext db, BusinessContext bizContext)
    {
        var company = new Company { Name = "Test Co" };
        db.Companies.Add(company);
        var business = new Business { CompanyId = company.Id, Name = "Test Shop", Currency = "BDT" };
        db.Businesses.Add(business);
        var owner = new User
        {
            CompanyId = company.Id, Name = "Owner", Phone = "01700000001",
            PasswordHash = "x", Role = Roles.Owner, IsActive = true
        };
        db.Users.Add(owner);
        var customer = new Customer { BusinessId = business.Id, Name = "Test Customer", Phone = "01800000001" };
        db.Customers.Add(customer);
        var branch = new Branch { BusinessId = business.Id, Name = "Main", Code = "MAIN", IsDefault = true, IsActive = true };
        db.Branches.Add(branch);
        await db.SaveChangesAsync();

        // Mirrors what BusinessContextMiddleware does per-request in production — must be set
        // after the business exists so the global BusinessId query filter matches in tests.
        bizContext.CurrentBusinessId = business.Id;

        return (business, branch, owner, customer);
    }

    // Orders are seeded one at a time, each in its own SaveChangesAsync call, so
    // AppDbContext's CreatedAt=UtcNow-on-Add override gives them a real, ascending chronological
    // order to test "last N orders" logic against — a single batched save wouldn't reliably do so.
    private static async Task SeedOrderAsync(AppDbContext db, Business business, Branch branch, User owner, Customer customer,
        string fulfillmentStatus, decimal unitPrice = 100, string paymentStatus = "UNPAID")
    {
        var order = new Order
        {
            BusinessId = business.Id,
            BranchId = branch.Id,
            OrderNo = $"ORD-{Guid.NewGuid():N}"[..12],
            Channel = "PHONE",
            BusinessDate = DateOnly.FromDateTime(DateTime.UtcNow),
            CustomerId = customer.Id,
            CustomerName = customer.Name,
            CustomerPhone = customer.Phone,
            OrderStatus = "COMPLETED",
            PaymentStatus = paymentStatus,
            FulfillmentStatus = fulfillmentStatus,
            CreatedBy = owner.Id
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        db.OrderItems.Add(new OrderItem { OrderId = order.Id, VariantId = Guid.NewGuid(), Qty = 1, UnitPrice = unitPrice });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetAsync_UnpaidOrder_ReturnsCorrectUnpaidBalance()
    {
        var (db, bizContext) = NewDb();
        var (business, branch, owner, customer) = await SeedCustomerAsync(db, bizContext);
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED", unitPrice: 500);

        var sut = NewService(db);
        var result = await sut.GetAsync(customer.Id);

        Assert.Equal(500, result.UnpaidBalance);
    }

    [Fact]
    public async Task GetAsync_PaidOrder_ExcludedFromUnpaidBalance()
    {
        var (db, bizContext) = NewDb();
        var (business, branch, owner, customer) = await SeedCustomerAsync(db, bizContext);
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED", unitPrice: 500, paymentStatus: "PAID");

        var sut = NewService(db);
        var result = await sut.GetAsync(customer.Id);

        Assert.Equal(0, result.UnpaidBalance);
    }

    [Fact]
    public async Task IsSerialRejecter_TwoOfLastFourReturned_True()
    {
        var (db, bizContext) = NewDb();
        var (business, branch, owner, customer) = await SeedCustomerAsync(db, bizContext);
        await SeedOrderAsync(db, business, branch, owner, customer, "RETURNED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");
        await SeedOrderAsync(db, business, branch, owner, customer, "RETURNED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");

        var sut = NewService(db);
        var result = await sut.GetAsync(customer.Id);

        Assert.True(result.IsSerialRejecter);
        Assert.Equal(2, result.RecentReturnCount);
        Assert.Equal(4, result.RecentOrderCount);
    }

    [Fact]
    public async Task IsSerialRejecter_OneOfLastFourReturned_False()
    {
        var (db, bizContext) = NewDb();
        var (business, branch, owner, customer) = await SeedCustomerAsync(db, bizContext);
        await SeedOrderAsync(db, business, branch, owner, customer, "RETURNED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");

        var sut = NewService(db);
        var result = await sut.GetAsync(customer.Id);

        Assert.False(result.IsSerialRejecter);
    }

    [Fact]
    public async Task IsSerialRejecter_OldReturnsOutsideWindow_DoNotCount()
    {
        var (db, bizContext) = NewDb();
        var (business, branch, owner, customer) = await SeedCustomerAsync(db, bizContext);
        // Two old returns, then 4 clean orders — the two returns fall outside the "last 4" window.
        await SeedOrderAsync(db, business, branch, owner, customer, "RETURNED");
        await SeedOrderAsync(db, business, branch, owner, customer, "RETURNED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");

        var sut = NewService(db);
        var result = await sut.GetAsync(customer.Id);

        Assert.False(result.IsSerialRejecter);
        Assert.Equal(0, result.RecentReturnCount);
        // But the all-time return count still reflects both old returns.
        Assert.Equal(2, result.ReturnCount);
        Assert.Equal(6, result.OrderCount);
    }

    [Fact]
    public async Task GetAsync_NoOrders_ReturnsZeroedStatsAndNullLastOrderAt()
    {
        var (db, bizContext) = NewDb();
        var (_, _, _, customer) = await SeedCustomerAsync(db, bizContext);

        var sut = NewService(db);
        var result = await sut.GetAsync(customer.Id);

        Assert.Equal(0, result.OrderCount);
        Assert.Equal(0, result.ReturnCount);
        Assert.Null(result.LastOrderAt);
        Assert.False(result.IsSerialRejecter);
        Assert.Equal(0, result.UnpaidBalance);
    }

    [Fact]
    public async Task GetAsync_LastOrderAt_MatchesMostRecentOrder()
    {
        var (db, bizContext) = NewDb();
        var (business, branch, owner, customer) = await SeedCustomerAsync(db, bizContext);
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED");
        var lastOrderCreatedAt = db.Orders.OrderByDescending(o => o.CreatedAt).First().CreatedAt;

        var sut = NewService(db);
        var result = await sut.GetAsync(customer.Id);

        Assert.Equal(lastOrderCreatedAt, result.LastOrderAt);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesFieldsAndReturnsFreshComputedDto()
    {
        var (db, bizContext) = NewDb();
        var (business, branch, owner, customer) = await SeedCustomerAsync(db, bizContext);
        await SeedOrderAsync(db, business, branch, owner, customer, "DELIVERED", unitPrice: 300);

        var sut = NewService(db);
        var result = await sut.UpdateAsync(customer.Id, new UpdateCustomerRequest("Renamed", "New Address", 2000, "note"), owner.Id);

        Assert.Equal("Renamed", result.Name);
        Assert.Equal("New Address", result.Address);
        Assert.Equal(2000, result.CreditLimit);
        Assert.Equal(300, result.UnpaidBalance);
    }

    [Fact]
    public async Task ListAsync_FiltersByNameOrPhone()
    {
        var (db, bizContext) = NewDb();
        var (business, _, _, _) = await SeedCustomerAsync(db, bizContext);
        db.Customers.Add(new Customer { BusinessId = business.Id, Name = "Another Person", Phone = "01900000002" });
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var results = await sut.ListAsync("Test Customer");

        Assert.Single(results);
        Assert.Equal("Test Customer", results[0].Name);
    }
}
