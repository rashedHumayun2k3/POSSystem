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

        var customerAddress = BuildAddressString(request.BuildingStreet, request.ColonyLandmark, request.City);
        await SaveAddressForPhoneAsync(request);

        var checkoutGroup = new CpCheckoutGroup
        {
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
        };
        _db.CpCheckoutGroups.Add(checkoutGroup);
        await _db.SaveChangesAsync();

        var isDhaka = request.City.Trim().Equals("Dhaka", StringComparison.OrdinalIgnoreCase);
        var results = new List<ClientPageShopOrderResultDto>();

        foreach (var shopGroup in variants.GroupBy(v => v.Product.BusinessId))
        {
            var businessId = shopGroup.Key;
            var business = await _db.Businesses.IgnoreQueryFilters()
                .FirstOrDefaultAsync(b => b.Id == businessId && b.DeletedAt == null);
            if (business == null) continue;

            var branches = await _db.Branches.IgnoreQueryFilters()
                .Where(b => b.BusinessId == businessId && b.DeletedAt == null && b.IsActive)
                .ToListAsync();
            var defaultBranch = branches.FirstOrDefault(b => b.IsDefault) ?? branches.FirstOrDefault();
            if (defaultBranch == null)
            {
                results.Add(new ClientPageShopOrderResultDto(businessId, business.Name, false, null, null, "This shop has no active branch to fulfill orders from.", 0));
                continue;
            }

            var items = shopGroup.Select(v => new OrderItemInput(
                v.Id,
                request.Items.First(i => i.VariantId == v.Id).Qty,
                v.PriceOverride ?? v.Product.SellingPrice
            )).ToList();

            // Prefer the default branch, but a multi-branch business can easily have stock sitting
            // in a branch that isn't the default one — always forcing the default here just means
            // Confirm fails later with "0 available" and no clue why. Same "fulfill from wherever
            // actually has the stock" principle Shopify/WooCommerce multi-location inventory uses:
            // fall back to whichever OTHER active branch can fully cover this order's items, if any
            // can. If no single branch covers everything (split fulfillment), default branch wins
            // and staff sort it out manually — the order's still a draft, so nothing's reserved yet.
            var chosenBranch = defaultBranch;
            if (branches.Count > 1 && !await BranchCanFulfillAsync(defaultBranch.Id, items))
            {
                foreach (var candidate in branches.Where(b => b.Id != defaultBranch.Id))
                {
                    if (await BranchCanFulfillAsync(candidate.Id, items))
                    {
                        chosenBranch = candidate;
                        break;
                    }
                }
            }

            _businessContext.CurrentBusinessId = businessId;
            _businessContext.CurrentBranchId = chosenBranch.Id;

            var storefrontUserId = await GetOrCreateStorefrontUserAsync(business);

            var (deliveryCharge, courierId) = await GetDeliveryChargeAsync(businessId, isDhaka);

            try
            {
                var order = await _orders.CreateAsync(new CreateOrderRequest(
                    Channel: "WEBSITE",
                    CustomerPhone: request.CustomerPhone,
                    CustomerName: request.CustomerName,
                    CustomerAddress: customerAddress,
                    // Draft, not auto-confirmed: staff calls the customer to confirm the order
                    // (existing Confirm button/flow, same one used for manually-entered
                    // Facebook/WhatsApp orders) before it becomes packable. Stock is reserved at
                    // that Confirm step, not at checkout time — see CreateAsync's auto-confirm
                    // guard, which only runs for non-draft orders.
                    IsDraft: true,
                    Items: items,
                    DiscountType: null,
                    DiscountValue: null,
                    DeliveryChargeCustomer: deliveryCharge,
                    AdvancePaid: 0,
                    AdvancePaymentMethod: null,
                    // No boilerplate "placed via storefront" note — the order detail page's
                    // "Order Came From" line already shows the WEBSITE channel.
                    Note: null,
                    ClientUid: BuildShopClientUid(request.ClientUid, businessId),
                    CourierId: courierId
                ), storefrontUserId);

                _db.CpCheckoutGroupOrders.Add(new CpCheckoutGroupOrder
                {
                    CheckoutGroupId = checkoutGroup.Id,
                    OrderId = order.Id,
                    BusinessId = businessId,
                });
                await _db.SaveChangesAsync();

                results.Add(new ClientPageShopOrderResultDto(businessId, business.Name, true, order.Id, order.OrderNo, null, deliveryCharge));

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
                    $"Some items are no longer available: {string.Join(", ", ex.UnavailableItems)}", 0));
            }
        }

        return new ClientPageCheckoutResultDto(checkoutGroup.Id, results);
    }

    public async Task<ClientPageShippingAddressDto?> GetSavedAddressAsync(string phone)
    {
        var saved = await _db.CpShippingAddresses.FirstOrDefaultAsync(a => a.Phone == phone);
        if (saved == null) return null;
        return new ClientPageShippingAddressDto(saved.FullName, saved.Phone, saved.BuildingStreet, saved.ColonyLandmark, saved.City, saved.Label);
    }

    // Lets the checkout page show the real delivery charge before the customer submits, using the
    // exact same lookup CreateGuestOrderAsync uses at submission time — no order is created here.
    public async Task<List<ClientPageDeliveryEstimateItemDto>> GetDeliveryEstimatesAsync(ClientPageDeliveryEstimateRequest request)
    {
        var isDhaka = request.City.Trim().Equals("Dhaka", StringComparison.OrdinalIgnoreCase);
        var results = new List<ClientPageDeliveryEstimateItemDto>();
        foreach (var businessId in request.BusinessIds.Distinct())
        {
            var (charge, _) = await GetDeliveryChargeAsync(businessId, isDhaka);
            results.Add(new ClientPageDeliveryEstimateItemDto(businessId, charge));
        }
        return results;
    }

    // Every shop configures its own couriers with its own Dhaka/outside-Dhaka rates (More →
    // Settings → Couriers in the staff app) — every business gets one auto-provisioned at signup
    // (see AuthService.CompleteSignupAsync), but fall back to a free delivery charge instead of
    // blocking checkout if an older business still somehow has none.
    private async Task<(decimal Charge, Guid? CourierId)> GetDeliveryChargeAsync(Guid businessId, bool isDhaka)
    {
        var defaultCourier = await _db.Couriers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.BusinessId == businessId && c.DeletedAt == null && c.IsActive && c.IsDefault);
        if (defaultCourier == null) return (0m, null);
        return (isDhaka ? defaultCourier.InsideDhakaCharge : defaultCourier.OutsideDhakaCharge, defaultCourier.Id);
    }

    // IgnoreQueryFilters — this runs before _businessContext.CurrentBranchId/CurrentBusinessId are
    // set for this order, so the normal branch-scoped query filter on BranchVariantInventories
    // isn't active yet (and branchId here isn't necessarily the eventual CurrentBranchId anyway,
    // since this is exactly what's deciding it).
    private async Task<bool> BranchCanFulfillAsync(Guid branchId, List<OrderItemInput> items)
    {
        foreach (var item in items)
        {
            var inv = await _db.BranchVariantInventories.IgnoreQueryFilters().AsNoTracking()
                .FirstOrDefaultAsync(i => i.BranchId == branchId && i.VariantId == item.VariantId);
            var available = inv == null ? 0m : inv.OnHand - inv.Committed - inv.Damaged;
            if (available < item.Qty) return false;
        }
        return true;
    }

    private static string BuildAddressString(string buildingStreet, string? colonyLandmark, string city)
    {
        var parts = new[] { buildingStreet, colonyLandmark, city }.Where(p => !string.IsNullOrWhiteSpace(p));
        return string.Join(", ", parts);
    }

    // Upsert-in-place, not append-only — this is a "remember my last address" convenience cache
    // keyed by phone, not order/pricing history, so overwriting is the intended behavior (see
    // CpShippingAddress.cs).
    private async Task SaveAddressForPhoneAsync(ClientPageCheckoutRequest request)
    {
        var existing = await _db.CpShippingAddresses.FirstOrDefaultAsync(a => a.Phone == request.CustomerPhone);
        if (existing == null)
        {
            _db.CpShippingAddresses.Add(new CpShippingAddress
            {
                Phone = request.CustomerPhone,
                FullName = request.CustomerName,
                BuildingStreet = request.BuildingStreet,
                ColonyLandmark = request.ColonyLandmark,
                City = request.City,
                Label = request.Label,
            });
        }
        else
        {
            existing.FullName = request.CustomerName;
            existing.BuildingStreet = request.BuildingStreet;
            existing.ColonyLandmark = request.ColonyLandmark;
            existing.City = request.City;
            existing.Label = request.Label;
        }
        await _db.SaveChangesAsync();
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
