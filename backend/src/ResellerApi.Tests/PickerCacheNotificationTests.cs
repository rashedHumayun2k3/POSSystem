using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http.Features;
using System.Security.Claims;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Hubs;
using ResellerApi.Infrastructure;
using ResellerApi.Middleware;

namespace ResellerApi.Tests;

public class PickerCacheNotificationTests
{
    [Fact]
    public async Task HubRejectsOtherBusinessAndNormalizesAuthorizedGroup()
    {
        var scope = new BusinessContext();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, scope);
        var userId = Guid.NewGuid();
        var businessId = Guid.NewGuid();
        db.BusinessUsers.Add(new BusinessUser { BusinessId = businessId, UserId = userId });
        await db.SaveChangesAsync();
        var groups = new Groups();
        var hub = new LiveHub(db) { Context = new Caller(userId), Groups = groups };
        await Assert.ThrowsAsync<HubException>(() => hub.JoinBusiness(Guid.NewGuid().ToString()));
        await Assert.ThrowsAsync<HubException>(() => hub.JoinBusiness("invalid"));
        Assert.Null(groups.Joined);
        await hub.JoinBusiness(businessId.ToString().ToUpperInvariant());
        Assert.Equal($"business_{businessId}", groups.Joined);
    }

    private sealed class Groups : IGroupManager
    {
        public string? Joined;
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        { Joined = groupName; return Task.CompletedTask; }
        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
    private sealed class Caller(Guid userId) : HubCallerContext
    {
        public override string ConnectionId => "test";
        public override string? UserIdentifier => userId.ToString();
        public override ClaimsPrincipal User => new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "test"));
        public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();
        public override IFeatureCollection Features { get; } = new FeatureCollection();
        public override CancellationToken ConnectionAborted => CancellationToken.None;
        public override void Abort() { }
    }

    [Theory]
    [InlineData("/api/v1/orders/1/confirm", "POST", "products,customers")]
    [InlineData("/api/v1/products/1", "DELETE", "products")]
    [InlineData("/api/v1/products/import", "POST", "products")]
    [InlineData("/api/v1/purchase-trips/1/receive", "POST", "products")]
    [InlineData("/api/v1/customers/1", "PUT", "customers")]
    [InlineData("/api/v1/products", "GET", "")]
    [InlineData("/api/v1/products/import/preview", "POST", "")]
    [InlineData("/api/v1/orders/1/receipt/send", "POST", "")]
    public void MapsAffectedResources(string path, string method, string expected) =>
        Assert.Equal(expected, string.Join(',', PickerCacheNotificationMiddleware.AffectedResources(path, method)));

    [Theory]
    [InlineData(200, false, 1)]
    [InlineData(204, false, 1)]
    [InlineData(400, false, 0)]
    [InlineData(500, false, 0)]
    [InlineData(200, true, 1)]
    public async Task NotifiesAfterSuccessAndToleratesDeliveryFailure(int status, bool failDelivery, int expected)
    {
        var finished = false;
        var client = new Client(() => { Assert.True(finished); if (failDelivery) throw new IOException("Unavailable"); });
        var hub = new Hub(client);
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/v1/orders";
        context.Request.Method = "POST";
        var middleware = new PickerCacheNotificationMiddleware(ctx => { finished = true; ctx.Response.StatusCode = status; return Task.CompletedTask; });
        await middleware.InvokeAsync(context, scope, hub, NullLogger<PickerCacheNotificationMiddleware>.Instance);
        Assert.Equal(expected, client.Calls);
        Assert.Equal(status, context.Response.StatusCode);
        if (expected > 0) Assert.Equal($"business_{scope.CurrentBusinessId}", hub.ClientsImpl.GroupName);
    }

    private sealed class Client(Action send) : IClientProxy
    {
        public int Calls;
        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
        {
            Assert.Equal("PickerDataChanged", method);
            Calls++; send(); return Task.CompletedTask;
        }
    }
    private sealed class HubClients(IClientProxy client) : IHubClients
    {
        public string? GroupName;
        public IClientProxy All => client;
        public IClientProxy AllExcept(IReadOnlyList<string> ids) => client;
        public IClientProxy Client(string id) => client;
        public IClientProxy Clients(IReadOnlyList<string> ids) => client;
        public IClientProxy Group(string name) { GroupName = name; return client; }
        public IClientProxy GroupExcept(string name, IReadOnlyList<string> ids) => client;
        public IClientProxy Groups(IReadOnlyList<string> names) => client;
        public IClientProxy User(string id) => client;
        public IClientProxy Users(IReadOnlyList<string> ids) => client;
    }
    private sealed class Hub(IClientProxy client) : IHubContext<LiveHub>
    {
        public HubClients ClientsImpl { get; } = new(client);
        public IHubClients Clients => ClientsImpl;
        public IGroupManager Groups => throw new NotSupportedException();
    }
}
