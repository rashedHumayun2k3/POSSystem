using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.ExternalOrders;
using ResellerApi.DTOs.Orders;
using ResellerApi.Entities;
using ResellerApi.Hubs;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ExternalOrderService : IExternalOrderService
{
    private readonly AppDbContext _db;
    private readonly BusinessContext _businessContext;
    private readonly IOrderService _orders;
    private readonly IHubContext<LiveHub> _hub;

    public ExternalOrderService(AppDbContext db, BusinessContext businessContext, IOrderService orders, IHubContext<LiveHub> hub)
    {
        _db = db;
        _businessContext = businessContext;
        _orders = orders;
        _hub = hub;
    }

    public async Task<ExternalOrderCreateResponse> CreateAsync(string apiKey, ExternalOrderCreateRequest request)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new UnauthorizedAccessException("Missing external order API key.");
        if (request.Items.Count == 0)
            throw new ArgumentException("At least one order item is required.");

        var keyHash = HashSecret(apiKey);
        var integration = await _db.ExternalOrderIntegrations.IgnoreQueryFilters()
            .Include(i => i.Business)
            .FirstOrDefaultAsync(i => i.KeyHash == keyHash && i.DeletedAt == null && i.IsActive);
        if (integration == null)
            throw new UnauthorizedAccessException("Invalid external order API key.");

        var branches = await _db.Branches.IgnoreQueryFilters()
            .Where(b => b.BusinessId == integration.BusinessId && b.DeletedAt == null && b.IsActive)
            .ToListAsync();
        var branch = request.BranchId.HasValue
            ? branches.FirstOrDefault(b => b.Id == request.BranchId.Value)
            : branches.FirstOrDefault(b => b.IsDefault) ?? branches.FirstOrDefault();
        if (branch == null)
            throw new InvalidOperationException("This business has no active branch to fulfill external orders.");

        _businessContext.CurrentBusinessId = integration.BusinessId;
        _businessContext.CurrentBranchId = branch.Id;

        var storefrontUserId = await GetOrCreateExternalOrderUserAsync(integration.Business);
        var items = await BuildOrderItemsAsync(integration.BusinessId, request.Items);
        var clientUid = BuildClientUid(integration.Id, request.ExternalOrderId);
        var note = BuildNote(integration, request);

        var order = await _orders.CreateAsync(new CreateOrderRequest(
            Channel: "WEBSITE",
            CustomerPhone: request.CustomerPhone,
            CustomerName: request.CustomerName,
            CustomerAddress: request.CustomerAddress,
            IsDraft: true,
            Items: items,
            DiscountType: null,
            DiscountValue: null,
            DeliveryChargeCustomer: request.DeliveryChargeCustomer ?? 0,
            AdvancePaid: request.AdvancePaid ?? 0,
            AdvancePaymentMethod: request.AdvancePaymentMethod,
            Note: note,
            ClientUid: clientUid,
            CourierId: request.CourierId,
            BusinessDate: request.BusinessDate,
            BranchId: branch.Id
        ), storefrontUserId);

        var entity = await _db.Orders.FirstAsync(o => o.Id == order.Id);
        entity.Source = "EXTERNAL_WEBSITE";
        entity.ExternalSource = request.SourceWebsiteUrl ?? integration.SourceWebsiteUrl ?? integration.Name;
        entity.ExternalOrderId = request.ExternalOrderId;
        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"business_{integration.BusinessId}").SendAsync("OrderCreated", new
        {
            orderId = order.Id,
            orderNo = order.OrderNo,
            channel = "WEBSITE",
            source = "EXTERNAL_WEBSITE",
            customerName = request.CustomerName,
            itemCount = request.Items.Count,
            createdAt = DateTime.UtcNow,
        });

        return new ExternalOrderCreateResponse(true, order.Id, order.OrderNo, "DRAFT", "EXTERNAL_WEBSITE", request.ExternalOrderId);
    }

    private async Task<List<OrderItemInput>> BuildOrderItemsAsync(Guid businessId, List<ExternalOrderItemRequest> requestItems)
    {
        var result = new List<OrderItemInput>();
        foreach (var item in requestItems)
        {
            if (item.Qty <= 0)
                throw new ArgumentException("Item quantity must be greater than zero.");

            var variant = await ResolveVariantAsync(businessId, item);
            var unitPrice = item.UnitPrice ?? variant.PriceOverride ?? variant.Product.SellingPrice;
            result.Add(new OrderItemInput(variant.Id, item.Qty, unitPrice));
        }
        return result;
    }

    private async Task<ProductVariant> ResolveVariantAsync(Guid businessId, ExternalOrderItemRequest item)
    {
        var query = _db.ProductVariants.IgnoreQueryFilters()
            .Include(v => v.Product)
            .Where(v => v.BusinessId == businessId && v.DeletedAt == null &&
                        v.Product.DeletedAt == null && v.Product.Status == "ACTIVE");

        ProductVariant? variant = null;
        if (item.VariantId.HasValue)
            variant = await query.FirstOrDefaultAsync(v => v.Id == item.VariantId.Value);
        else if (!string.IsNullOrWhiteSpace(item.Sku))
            variant = await query.FirstOrDefaultAsync(v => v.Sku == item.Sku.Trim());
        else if (!string.IsNullOrWhiteSpace(item.Barcode))
            variant = await query.FirstOrDefaultAsync(v => v.Barcode == item.Barcode.Trim());

        return variant ?? throw new ArgumentException("One or more order items could not be matched to an active product variant.");
    }

    private async Task<Guid> GetOrCreateExternalOrderUserAsync(Business business)
    {
        var existing = await _db.Users
            .IgnoreQueryFilters()
            .Where(u => u.Role == "EXTERNAL_ORDER_SYSTEM" &&
                        _db.BusinessUsers.Any(bu => bu.UserId == u.Id && bu.BusinessId == business.Id))
            .FirstOrDefaultAsync();
        if (existing != null) return existing.Id;

        var user = new User
        {
            CompanyId = business.CompanyId,
            Name = "External Website Orders",
            Phone = $"EXT-{business.Id:N}"[..20],
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
            Role = "EXTERNAL_ORDER_SYSTEM",
            IsActive = false,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        _db.BusinessUsers.Add(new BusinessUser { BusinessId = business.Id, UserId = user.Id });
        await _db.SaveChangesAsync();

        return user.Id;
    }

    private static string? BuildClientUid(Guid integrationId, string? externalOrderId)
    {
        if (string.IsNullOrWhiteSpace(externalOrderId)) return null;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{integrationId}:{externalOrderId.Trim()}"));
        return Convert.ToHexString(bytes)[..32];
    }

    private static string? BuildNote(ExternalOrderIntegration integration, ExternalOrderCreateRequest request)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(request.Note)) parts.Add(request.Note.Trim());
        if (!string.IsNullOrWhiteSpace(request.ExternalOrderId)) parts.Add($"External order: {request.ExternalOrderId.Trim()}");
        var source = request.SourceWebsiteUrl ?? integration.SourceWebsiteUrl;
        if (!string.IsNullOrWhiteSpace(source)) parts.Add($"Source: {source.Trim()}");
        return parts.Count == 0 ? null : string.Join("\n", parts);
    }

    public static string HashSecret(string secret)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(secret.Trim()));
        return Convert.ToHexString(bytes);
    }
}
