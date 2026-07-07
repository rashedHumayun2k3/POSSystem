using System.Security.Claims;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Middleware;

/// <summary>
/// Read-only lockout: once a company's trial/subscription has lapsed, GET requests still work
/// (so the owner can see and export their data) but any mutating request is blocked with 402
/// until they subscribe. Auth and the subscriptions endpoints themselves are always reachable —
/// otherwise a locked-out owner could never log in to pay.
/// </summary>
public class SubscriptionGateMiddleware
{
    private static readonly HashSet<string> SafeMethods = new(StringComparer.OrdinalIgnoreCase) { "GET", "HEAD", "OPTIONS" };

    private readonly RequestDelegate _next;

    public SubscriptionGateMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, ISubscriptionService subscriptions)
    {
        var path = context.Request.Path.Value ?? "";

        if (path.StartsWith("/api/v1/auth", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/v1/subscriptions", StringComparison.OrdinalIgnoreCase) ||
            SafeMethods.Contains(context.Request.Method) ||
            !(context.User.Identity?.IsAuthenticated ?? false))
        {
            await _next(context);
            return;
        }

        var companyIdClaim = context.User.FindFirstValue("company_id");
        if (companyIdClaim is null || !Guid.TryParse(companyIdClaim, out var companyId))
        {
            await _next(context);
            return;
        }

        if (await subscriptions.IsReadOnlyLockedAsync(companyId))
        {
            context.Response.StatusCode = 402;
            await context.Response.WriteAsJsonAsync(new
            {
                code = "SUBSCRIPTION_EXPIRED",
                message = "Your trial or subscription has expired. Please subscribe to continue making changes."
            });
            return;
        }

        await _next(context);
    }
}
