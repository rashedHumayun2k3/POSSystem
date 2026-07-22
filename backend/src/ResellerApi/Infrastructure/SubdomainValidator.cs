using System.Text.RegularExpressions;

namespace ResellerApi.Infrastructure;

public static partial class SubdomainValidator
{
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "api", "admin", "shop", "cart", "checkout", "account", "category", "categories",
        "product", "search", "login", "signup", "static", "app"
    };

    [GeneratedRegex("^[a-z0-9][a-z0-9-]*[a-z0-9]$")]
    private static partial Regex SlugPattern();

    // Returns an error message if invalid, or null if valid.
    public static string? Validate(string subdomain)
    {
        var s = subdomain.Trim().ToLowerInvariant();

        if (s.Length < 3 || s.Length > 30 || !SlugPattern().IsMatch(s))
            return "Subdomain must be 3-30 characters, lowercase letters/numbers/hyphens only, and can't start or end with a hyphen.";

        if (Reserved.Contains(s))
            return "This subdomain is reserved. Please choose another.";

        return null;
    }

    public static string Normalize(string subdomain) => subdomain.Trim().ToLowerInvariant();
}
