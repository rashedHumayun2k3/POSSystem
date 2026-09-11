namespace ResellerApi.Infrastructure;

// Branding/mode info resolved per-request for a ClientPage storefront request. Deliberately a
// separate scoped POCO from IBusinessContext — that one is only about *tenant scoping* (and
// ClientPageShopContextMiddleware sets BusinessContext.CurrentBusinessId directly, in shop mode,
// so existing tenant-scoped services keep working unmodified). This one carries the extra
// display fields (name/branding) the storefront frontend needs that IBusinessContext has no
// reason to know about.
public class ClientPageShopContext
{
    public bool IsShopMode { get; set; }
    public Guid? BusinessId { get; set; }
    public string? ShopName { get; set; }
    public string? LogoUrl { get; set; }
    public string? BannerUrl { get; set; }
    public string? WebsiteUrl { get; set; }
}
