using ResellerApi.Data;
using ResellerApi.Infrastructure;

namespace ResellerApi.Middleware;

public class RegisteredStorefrontCorsMiddleware
{
    private readonly RequestDelegate _next;

    public RegisteredStorefrontCorsMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        var path = context.Request.Path.Value ?? "";
        var origin = context.Request.Headers.Origin.FirstOrDefault();

        if (!path.StartsWith("/api/v1/clientpage", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(origin) ||
            !await IsRegisteredOriginAsync(db, origin, context.RequestAborted))
        {
            await _next(context);
            return;
        }

        context.Response.OnStarting(() =>
        {
            context.Response.Headers.AccessControlAllowOrigin = origin;
            context.Response.Headers.AccessControlAllowHeaders = "Authorization,Content-Type";
            context.Response.Headers.AccessControlAllowMethods = "GET,POST,OPTIONS";
            context.Response.Headers.AccessControlAllowCredentials = "true";
            context.Response.Headers.Vary = "Origin";
            return Task.CompletedTask;
        });

        if (HttpMethods.IsOptions(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status204NoContent;
            return;
        }

        await _next(context);
    }

    private static async Task<bool> IsRegisteredOriginAsync(AppDbContext db, string origin, CancellationToken cancellationToken)
    {
        var registeredOrigins = await StorefrontCorsOrigins.GetRegisteredStorefrontOriginsAsync(db, cancellationToken);
        return registeredOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
    }
}

