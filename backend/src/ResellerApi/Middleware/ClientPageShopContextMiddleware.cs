using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;

namespace ResellerApi.Middleware;

// Resolves which "shop" (Business) a public ClientPage request is for, from the HTTP Host
// header — the ClientPage equivalent of BusinessContextMiddleware, but for anonymous storefront
// traffic instead of authenticated staff sessions. Only runs for /api/v1/clientpage/* routes;
// everything else passes through untouched.
//
// Shop mode sets BusinessContext.CurrentBusinessId directly (the same scoped POCO the staff
// pipeline uses) so every existing BusinessScopedEntity query filter — and therefore every
// existing tenant-scoped service (ProductService, CategoryService, ...) — already works
// correctly for shop-mode ClientPage requests with zero new filtering logic. Marketplace mode
// leaves it unset; marketplace reads use IgnoreQueryFilters() deliberately instead (see
// ClientPageCatalogService), so an unset CurrentBusinessId there is harmless.
public class ClientPageShopContextMiddleware
{
    private readonly RequestDelegate _next;

    public ClientPageShopContextMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(
        HttpContext context,
        BusinessContext businessContext,
        ClientPageShopContext shopContext,
        AppDbContext db,
        IConfiguration config)
    {
        var path = context.Request.Path.Value ?? "";
        if (!path.StartsWith("/api/v1/clientpage", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var subdomain = ResolveSubdomain(context, config);

        if (!string.IsNullOrWhiteSpace(subdomain))
        {
            var business = await db.Businesses
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(b =>
                    b.DeletedAt == null &&
                    b.StorefrontEnabled &&
                    b.Subdomain == subdomain);

            if (business != null)
            {
                businessContext.CurrentBusinessId = business.Id;
                shopContext.IsShopMode = true;
                shopContext.BusinessId = business.Id;
                shopContext.ShopName = business.Name;
                shopContext.LogoUrl = business.LogoUrl;
                shopContext.BannerUrl = business.BannerUrl;
                shopContext.WebsiteUrl = business.ExternalWebsiteUrl;
                shopContext.WebsiteSettingsJson = business.WebsiteSettingsJson;
            }
        }

        await _next(context);
    }

    private static string? ResolveSubdomain(HttpContext context, IConfiguration config)
    {
        // Host-header resolution only works when the frontend and this API share an origin
        // (same-domain reverse proxy). The frontend and backend here are separate origins
        // (distinct CORS-listed ports/domains), so the backend never reliably sees the
        // *browser's* real Host — the frontend resolves its own Host (via its own Next.js
        // middleware) and passes the shop slug through explicitly instead. The ?shop= query
        // param is that explicit channel, always honored (not just a dev fallback): it only
        // ever unlocks a shop's already-public catalog + guest checkout, identical to what
        // visiting that shop's real subdomain directly already exposes — there's no private
        // data behind it, so there's nothing to "spoof". The one accepted tradeoff: reaching a
        // shop this way ignores ShowOnMarketplace, since that flag only controls aggregated
        // marketplace search results, not whether a known subdomain/slug is directly reachable.
        var shopParam = context.Request.Query["shop"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(shopParam))
            return shopParam;

        var baseDomain = config["ClientPage:BaseDomain"];
        var host = context.Request.Host.Host; // no port

        if (!string.IsNullOrWhiteSpace(baseDomain) &&
            host.EndsWith("." + baseDomain, StringComparison.OrdinalIgnoreCase))
        {
            var prefix = host[..^(baseDomain.Length + 1)];
            if (!string.IsNullOrWhiteSpace(prefix) && !prefix.Equals("www", StringComparison.OrdinalIgnoreCase))
                return prefix;
        }

        return null;
    }
}
