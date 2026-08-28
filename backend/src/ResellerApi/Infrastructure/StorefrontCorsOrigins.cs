using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;

namespace ResellerApi.Infrastructure;

public static class StorefrontCorsOrigins
{
    public static bool IsAllowed(string? origin, string[] allowedOrigins, IConfiguration config)
    {
        if (string.IsNullOrWhiteSpace(origin)) return false;
        if (allowedOrigins.Any(o => string.Equals(o, origin, StringComparison.OrdinalIgnoreCase))) return true;

        var allowedStorefrontOrigins = config.GetSection("AllowedStorefrontOrigins").Get<string[]>() ?? [];
        if (allowedStorefrontOrigins.Any(o => string.Equals(o, origin, StringComparison.OrdinalIgnoreCase))) return true;

        return false;
    }

    public static async Task<List<string>> GetRegisteredStorefrontOriginsAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        var urls = await db.Businesses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(b => b.DeletedAt == null && b.StorefrontEnabled && b.ExternalWebsiteUrl != null)
            .Select(b => b.ExternalWebsiteUrl!)
            .ToListAsync(cancellationToken);

        return urls.SelectMany(ToOrigins).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    public static IEnumerable<string> ToOrigins(string websiteUrl)
    {
        if (!Uri.TryCreate(websiteUrl, UriKind.Absolute, out var uri)) yield break;

        yield return $"{uri.Scheme}://{uri.Host}";

        if (uri.Host.StartsWith("www.", StringComparison.OrdinalIgnoreCase))
        {
            yield return $"{uri.Scheme}://{uri.Host[4..]}";
        }
        else
        {
            yield return $"{uri.Scheme}://www.{uri.Host}";
        }
    }
}

