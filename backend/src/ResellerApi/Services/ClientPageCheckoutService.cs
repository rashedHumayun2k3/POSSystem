using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.DTOs.Orders;
using ResellerApi.Entities;
using ResellerApi.Hubs;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ClientPageCheckoutService : IClientPageCheckoutService
{
    private readonly AppDbContext _db;
    private readonly BusinessContext _businessContext;
    private readonly IOrderService _orders;
    private readonly IHubContext<LiveHub> _hub;

    public ClientPageCheckoutService(AppDbContext db, BusinessContext businessContext, IOrderService orders, IHubContext<LiveHub> hub)
    {
        _db = db;
        _businessContext = businessContext;
        _orders = orders;
        _hub = hub;
    }

    public async Task<ClientPageCheckoutResultDto> CreateGuestOrderAsync(ClientPageCheckoutRequest request)
    {
        var variantIds = request.Items.Select(i => i.VariantId).ToList();
        var variants = await _db.ProductVariants
            .IgnoreQueryFilters()
            .Include(v => v.Product)
            .Where(v => variantIds.Contains(v.Id) &&
                        v.DeletedAt == null && v.Product.DeletedAt == null && v.Product.Status == "ACTIVE")
            .ToListAsync();

        var checkoutGroup = new CpCheckoutGroup
        {
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
        };
        _db.CpCheckoutGroups.Add(checkoutGroup);
        await _db.SaveChangesAsync();

        var results = new List<ClientPageShopOrderResultDto>();

        foreach (var shopGroup in variants.GroupBy(v => v.Product.BusinessId))
        {
            var businessId = shopGroup.Key;
            var business = await _db.Businesses.IgnoreQueryFilters()
                .FirstOrDefaultAsync(b => b.Id == businessId && b.DeletedAt == null);
            if (business == null) continue;

            var defaultBranch = await _db.Branches.IgnoreQueryFilters()
                .FirstOrDefaultAsync(b => b.BusinessId == businessId && b.DeletedAt == null && b.IsDefault);
            if (defaultBranch == null)
            {
                results.Add(new ClientPageShopOrderResultDto(businessId, business.Name, false, null, null, "This shop has no active branch to fulfill orders from."));
                continue;
            }

            _businessContext.CurrentBusinessId = businessId;
            _businessContext.CurrentBranchId = defaultBranch.Id;

            var storefrontUserId = await GetOrCreateStorefrontUserAsync(business);

            var items = shopGroup.Select(v => new OrderItemInput(
                v.Id,
                request.Items.First(i => i.VariantId == v.Id).Qty,
                v.PriceOverride ?? v.Product.SellingPrice
            )).ToList();

            try
            {
                var order = await _orders.CreateAsync(new CreateOrderRequest(
                    Channel: "WEBSITE",
                    CustomerPhone: request.CustomerPhone,
                    CustomerName: request.CustomerName,
                    CustomerAddress: request.CustomerAddress,
                    IsDraft: false,
                    Items: items,
                    DiscountType: null,
                    DiscountValue: null,
                    DeliveryChargeCustomer: 0,
                    AdvancePaid: 0,
                    AdvancePaymentMethod: null,
                    Note: "Placed via online storefront.",
                    ClientUid: BuildShopClientUid(request.ClientUid, businessId),
                    CourierId: null
                ), storefrontUserId);

                _db.CpCheckoutGroupOrders.Add(new CpCheckoutGroupOrder
                {
                    CheckoutGroupId = checkoutGroup.Id,
                    OrderId = order.Id,
                    BusinessId = businessId,
                });
                await _db.SaveChangesAsync();

                results.Add(new ClientPageShopOrderResultDto(businessId, business.Name, true, order.Id, order.OrderNo, null));

                await _hub.Clients.Group($"business_{businessId}").SendAsync("OrderCreated", new
                {
                    orderId = order.Id,
                    orderNo = order.OrderNo,
                    channel = "WEBSITE",
                    customerName = request.CustomerName,
                    itemCount = shopGroup.Count(),
                    createdAt = DateTime.UtcNow,
                });
            }
            catch (StockUnavailableException ex)
            {
                results.Add(new ClientPageShopOrderResultDto(businessId, business.Name, false, null, null,
                    $"Some items are no longer available: {string.Join(", ", ex.UnavailableItems)}"));
            }
        }

        return new ClientPageCheckoutResultDto(checkoutGroup.Id, results);
    }

    // Every Order requires a real CreatedByUserId, but a guest checkout has no staff user behind
    // it. Each business gets one lazily-created, unguessable, never-loggable-in system user
    // (IsActive=false, and Role is deliberately not one of the real Roles.All values, so it can
    // never pass any [Authorize(Roles=...)] check even if somehow authenticated) attributed as
    // the creator of its own guest orders.
    private async Task<Guid> GetOrCreateStorefrontUserAsync(Business business)
    {
        var existing = await _db.Users
            .IgnoreQueryFilters()
            .Where(u => u.Role == "STOREFRONT_SYSTEM" &&
                        _db.BusinessUsers.Any(bu => bu.UserId == u.Id && bu.BusinessId == business.Id))
            .FirstOrDefaultAsync();
        if (existing != null) return existing.Id;

        var user = new User
        {
            CompanyId = business.CompanyId,
            Name = "Storefront (Guest Orders)",
            Phone = $"SYS-{business.Id:N}"[..20],
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
            Role = "STOREFRONT_SYSTEM",
            IsActive = false,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        _db.BusinessUsers.Add(new BusinessUser { BusinessId = business.Id, UserId = user.Id });
        await _db.SaveChangesAsync();

        return user.Id;
    }

    // Order.ClientUid is capped at 50 chars (AppDbContext.cs) — a raw "{clientUid}:{businessId}"
    // concatenation (72+ chars) overflows it. A per-shop order still needs its own distinct
    // idempotency key (the same cart submitted twice, or one shop-group retried, must not double
    // -insert), so hash the pair down to a short, deterministic, collision-safe value instead.
    private static string? BuildShopClientUid(string? clientUid, Guid businessId)
    {
        if (string.IsNullOrWhiteSpace(clientUid)) return null;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{clientUid}:{businessId}"));
        return Convert.ToHexString(bytes)[..32];
    }
}
