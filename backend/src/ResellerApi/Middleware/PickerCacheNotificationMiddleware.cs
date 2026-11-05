using Microsoft.AspNetCore.SignalR;
using ResellerApi.Hubs;
using ResellerApi.Infrastructure;

namespace ResellerApi.Middleware;

// Send only after the endpoint has finished its writes/transactions. Events carry
// no catalog/customer data; clients re-fetch through the normal authorization checks.
public class PickerCacheNotificationMiddleware(RequestDelegate next)
{
    public static string[] AffectedResources(string path, string method)
    {
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method)) return [];
        var segments = path.Trim('/').Split('/');
        if (segments.Length < 3 || segments[0] != "api" || segments[1] != "v1") return [];
        if (segments.Contains("preview") || segments.Contains("barcode-labels") || segments.Contains("receipt")) return [];
        return segments[2] switch
        {
            "orders" => ["products", "customers"],
            "customers" => ["customers"],
            "products" or "categories" or "purchase-trips" or "supplier-returns" or "cartons" => ["products"],
            _ => []
        };
    }

    public async Task InvokeAsync(HttpContext context, BusinessContext business,
        IHubContext<LiveHub> hub, ILogger<PickerCacheNotificationMiddleware> logger)
    {
        await next(context);
        if (context.Response.StatusCode is < 200 or >= 300 || business.CurrentBusinessId == Guid.Empty) return;
        var resources = AffectedResources(context.Request.Path.Value ?? "", context.Request.Method);
        if (resources.Length == 0) return;
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            await hub.Clients.Group($"business_{business.CurrentBusinessId}").SendAsync("PickerDataChanged",
                new { businessId = business.CurrentBusinessId, resources }, timeout.Token);
        }
        catch (Exception ex)
        {
            // A notification failure must never turn a committed sale into an error.
            // Client fallback refresh also covers jobs, missed messages and API replicas.
            logger.LogWarning(ex, "Picker notification failed for business {BusinessId}", business.CurrentBusinessId);
        }
    }
}
