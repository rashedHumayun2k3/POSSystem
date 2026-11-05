using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;
using ResellerApi.DTOs.Orders;

namespace ResellerApi.Tests;

public class OrderNotificationTests
{
    private sealed class NoopLog : IActivityLogService
    {
        public Task LogAsync(Guid businessId, Guid userId, string action, string entityType, Guid? entityId = null, object? before = null, object? after = null) => Task.CompletedTask;
    }
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context) : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<BaseEntity>().Where(e => e.State is EntityState.Added or EntityState.Modified))
                entry.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }
    private sealed class Transport : HttpMessageHandler, IHttpClientFactory
    {
        public int Calls;
        public string? LastBody;
        public HttpStatusCode Status = HttpStatusCode.OK;
        public string Response = "{\"data\":{\"status\":\"ok\",\"id\":\"ticket-1\"}}";
        public HttpClient CreateClient(string name) => new(this, false);
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++; LastBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(Status) { Content = new StringContent(Response, Encoding.UTF8, "application/json") };
        }
    }
    private sealed class Fixture : IDisposable
    {
        public readonly BusinessContext Business = new() { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        public readonly TestDb Db;
        public readonly Transport Http = new();
        public readonly HttpContextAccessor Accessor = new() { HttpContext = new DefaultHttpContext() };
        public readonly Guid CompanyId = Guid.NewGuid();
        public User Owner = null!;
        public Order Order = null!;
        public RefreshToken Session = null!;
        public PushDevice Device = null!;
        public Fixture() => Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Business);
        public User AddUser(string role, bool assigned = false, bool active = true, Guid? businessId = null)
        {
            var user = new User { CompanyId = CompanyId, Name = role, Phone = Guid.NewGuid().ToString(), PasswordHash = "test", Role = role, IsActive = active };
            Db.Users.Add(user); Db.BusinessUsers.Add(new BusinessUser { User = user, BusinessId = businessId ?? Business.CurrentBusinessId });
            if (assigned) Db.UserBranches.Add(new UserBranch { User = user, BranchId = Business.CurrentBranchId!.Value });
            return user;
        }
        public async Task Init()
        {
            Db.Companies.Add(new Company { Id = CompanyId, Name = "Company" });
            Db.Businesses.Add(new Business { Id = Business.CurrentBusinessId, CompanyId = CompanyId, Name = "Shop", Currency = "BDT" });
            Db.Branches.Add(new Branch { Id = Business.CurrentBranchId!.Value, BusinessId = Business.CurrentBusinessId, Name = "Main", Code = "MAIN" });
            Owner = AddUser(Roles.Owner);
            Order = new Order { BusinessId = Business.CurrentBusinessId, BranchId = Business.CurrentBranchId, OrderNo = "PO-1", Channel = "WEBSITE", Source = "CLIENTPAGE",
                CustomerName = "Customer", CustomerPhone = "01700000000", CreatedBy = Owner.Id, IsDraft = true };
            Db.Orders.Add(Order); Db.OrderNotificationEvents.Add(new OrderNotificationEvent { OrderId = Order.Id });
            Session = new RefreshToken { User = Owner, Token = "refresh-token", ExpiresAt = DateTime.UtcNow.AddDays(1) };
            Db.RefreshTokens.Add(Session);
            Device = new PushDevice { Token = "ExponentPushToken[abcdefghijklmnop]", UserId = Owner.Id, BusinessId = Business.CurrentBusinessId,
                BranchId = Business.CurrentBranchId, RefreshTokenId = Session.Id, Language = "bn" };
            Db.PushDevices.Add(Device);
            await Db.SaveChangesAsync(); As(Owner);
        }
        public void As(User user) => Accessor.HttpContext!.User = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Role, user.Role)], "test"));
        public OrderNotificationService Service => new(Db, new CurrentUserService(Accessor), Business);
        public OrderNotificationWorker Worker(bool enabled = true) => new(Db, Http,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["PushNotifications:Enabled"] = enabled.ToString() }).Build(),
            NullLogger<OrderNotificationWorker>.Instance);
        public void Dispose() { Db.Dispose(); Http.Dispose(); }
    }

    [Fact]
    public async Task HistoryIsScopedToActiveRecipientsAndFanoutIsIdempotent()
    {
        using var f = new Fixture(); await f.Init();
        var staff = f.AddUser(Roles.Staff, assigned: true);
        f.AddUser(Roles.Staff); f.AddUser(Roles.Manager, active: false);
        await f.Db.SaveChangesAsync();
        await f.Worker(false).Run(); await f.Worker(false).Run();
        var recipients = await f.Db.OrderNotifications.Select(n => n.RecipientId).ToListAsync();
        Assert.Equal(2, recipients.Count); Assert.Contains(f.Owner.Id, recipients); Assert.Contains(staff.Id, recipients);
        Assert.Single(f.Db.OrderPushDeliveries); Assert.Equal(0, f.Http.Calls);
    }

    [Fact]
    public async Task OtherUsersAndBusinessesCannotReadNotifications()
    {
        using var f = new Fixture(); await f.Init(); await f.Worker(false).Run();
        var notification = await f.Db.OrderNotifications.SingleAsync();
        var other = f.AddUser(Roles.Owner); await f.Db.SaveChangesAsync(); f.As(other);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Read(notification.Id));
        f.As(f.Owner); f.Business.CurrentBusinessId = Guid.NewGuid();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Read(notification.Id));
        Assert.Null(notification.ReadAt);
    }

    [Fact]
    public async Task RegisteredDeviceMustBelongToLiveSessionOfCurrentUser()
    {
        using var f = new Fixture(); await f.Init();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => f.Service.Register(new(f.Device.Token, "someone-elses-token")));
        await f.Service.Register(new(f.Device.Token, f.Session.Token, "en"));
        Assert.Single(f.Db.PushDevices); Assert.Equal("en", f.Device.Language);
        await Assert.ThrowsAsync<ArgumentException>(() => f.Service.Register(new("https://attacker.example", f.Session.Token)));
    }

    [Fact]
    public async Task SendUsesLocalizedPayloadAndChecksReceipt()
    {
        using var f = new Fixture(); await f.Init(); await f.Worker().Run();
        var delivery = await f.Db.OrderPushDeliveries.SingleAsync();
        Assert.Equal("RECEIPT", delivery.State);
        using var body = JsonDocument.Parse(f.Http.LastBody!);
        Assert.Equal("নতুন অর্ডার এসেছে", body.RootElement.GetProperty("title").GetString());
        Assert.Equal(f.Order.Id.ToString(), body.RootElement.GetProperty("data").GetProperty("orderId").GetString());
        f.Http.Response = "{\"data\":{\"ticket-1\":{\"status\":\"ok\"}}}";
        delivery.NextAttemptAt = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();
        await f.Worker().Run(); Assert.Equal("DELIVERED", delivery.State); Assert.Equal(2, f.Http.Calls);
    }

    [Fact]
    public async Task TransientFailureRetriesWithoutDuplicatingHistory()
    {
        using var f = new Fixture(); await f.Init(); f.Http.Status = HttpStatusCode.ServiceUnavailable;
        await f.Worker().Run();
        var delivery = await f.Db.OrderPushDeliveries.SingleAsync();
        Assert.Equal("PENDING", delivery.State); Assert.Equal(1, delivery.Attempts);
        Assert.True(delivery.NextAttemptAt > DateTime.UtcNow);
        delivery.NextAttemptAt = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();
        f.Http.Status = HttpStatusCode.OK; await f.Worker().Run();
        Assert.Equal("RECEIPT", delivery.State); Assert.Single(f.Db.OrderNotifications);
    }

    [Theory]
    [InlineData("session")]
    [InlineData("membership")]
    [InlineData("account")]
    [InlineData("device")]
    public async Task RevokedAccessOrLogoutStopsQueuedDelivery(string revoke)
    {
        using var f = new Fixture(); await f.Init(); await f.Worker(false).Run();
        if (revoke == "session") f.Session.IsRevoked = true;
        if (revoke == "membership") f.Db.BusinessUsers.Remove(await f.Db.BusinessUsers.SingleAsync());
        if (revoke == "account") f.Owner.IsActive = false;
        if (revoke == "device") f.Device.UserId = Guid.NewGuid();
        await f.Db.SaveChangesAsync(); await f.Worker().Run();
        Assert.Equal(0, f.Http.Calls); Assert.Equal("CANCELLED", (await f.Db.OrderPushDeliveries.SingleAsync()).State);
    }

    [Fact]
    public async Task InvalidDeviceReceiptDisablesToken()
    {
        using var f = new Fixture(); await f.Init(); await f.Worker().Run();
        var delivery = await f.Db.OrderPushDeliveries.SingleAsync();
        delivery.NextAttemptAt = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();
        f.Http.Response = "{\"data\":{\"ticket-1\":{\"status\":\"error\",\"details\":{\"error\":\"DeviceNotRegistered\"}}}}";
        await f.Worker().Run(); Assert.False(f.Device.Enabled); Assert.Equal("CANCELLED", delivery.State);
    }

    [Fact]
    public async Task ManualOrdersDoNotGenerateAlerts()
    {
        using var f = new Fixture(); await f.Init(); f.Order.Source = "POS"; await f.Db.SaveChangesAsync();
        await f.Worker().Run(); Assert.Empty(f.Db.OrderNotifications); Assert.Equal(0, f.Http.Calls);
    }

    [Theory]
    [InlineData("CLIENTPAGE", true)]
    [InlineData("EXTERNAL_WEBSITE", true)]
    [InlineData("MANUAL", false)]
    public async Task OrderCreationWritesOutboxOnceAlongsideOrder(string source, bool expected)
    {
        using var f = new Fixture(); await f.Init();
        var service = new OrderService(f.Db, new NoopLog(), null!);
        var request = new CreateOrderRequest("WEBSITE", "01800000000", "Buyer", "Dhaka", true, [], null, null, 0, 0, null, null,
            "test-checkout-id", null, Source: source);
        var first = await service.CreateAsync(request, f.Owner.Id);
        var second = await service.CreateAsync(request, f.Owner.Id);
        Assert.Equal(first.Id, second.Id);
        Assert.Equal(expected ? 1 : 0, await f.Db.OrderNotificationEvents.CountAsync(e => e.OrderId == first.Id));
    }

    [Fact]
    public async Task RefreshPreservesDeviceBindingAndLogoutRevokesIt()
    {
        using var f = new Fixture(); await f.Init();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["Jwt:Key"] = new string('x', 64), ["Jwt:Issuer"] = "test", ["Jwt:Audience"] = "test",
        }).Build();
        var auth = new AuthService(f.Db, config, new NoopLog(), null!, null!);
        var response = await auth.RefreshAsync(f.Session.Token);
        Assert.True(f.Session.IsRevoked);
        var renewed = await f.Db.RefreshTokens.SingleAsync(t => t.Token == response.RefreshToken);
        Assert.Equal(renewed.Id, f.Device.RefreshTokenId); Assert.True(f.Device.Enabled);
        await auth.RevokeAsync(response.RefreshToken);
        Assert.False(f.Device.Enabled); Assert.True(renewed.IsRevoked);
    }

    [Fact]
    public async Task MalformedTicketSchedulesRetry()
    {
        using var f = new Fixture(); await f.Init(); f.Http.Response = "{\"data\":[]}";
        await f.Worker().Run(); var delivery = await f.Db.OrderPushDeliveries.SingleAsync();
        Assert.Equal("PENDING", delivery.State); Assert.Equal("InvalidTicket", delivery.LastError);
    }
}
