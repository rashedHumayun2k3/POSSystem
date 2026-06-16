using System.Security.Claims;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ResellerApi.Middleware;

public class BusinessContextMiddleware
{
    private readonly RequestDelegate _next;

    public BusinessContextMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, BusinessContext businessContext, AppDbContext db)
    {
        var path = context.Request.Path.Value ?? "";

        // Skip auth endpoints — they don't need a business context
        if (path.StartsWith("/api/v1/auth", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        if (!context.User.Identity?.IsAuthenticated ?? true)
        {
            await _next(context);
            return;
        }

        var businessIdHeader = context.Request.Headers["X-Business-Id"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(businessIdHeader) || !Guid.TryParse(businessIdHeader, out var businessId))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { code = "MISSING_BUSINESS_ID", message = "X-Business-Id header is required." });
            return;
        }

        var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var hasAccess = await db.BusinessUsers
            .AsNoTracking()
            .AnyAsync(bu => bu.BusinessId == businessId && bu.UserId == userId);

        if (!hasAccess)
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new { code = "BUSINESS_ACCESS_DENIED", message = "You do not have access to this business." });
            return;
        }

        businessContext.CurrentBusinessId = businessId;
        await _next(context);
    }
}
