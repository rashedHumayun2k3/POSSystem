using System.Text.Json;

namespace ResellerApi.Infrastructure;

// How the business sells, distinct from BusinessTypes (which is industry/product category).
public static class SalesChannels
{
    public const string Pos    = "POS";
    public const string Hawker = "HAWKER";
    public const string Online = "ONLINE";

    public static readonly IReadOnlySet<string> All = new HashSet<string> { Pos, Hawker, Online };

    // A business is either a full-barcode-scanner setup (Pos) or a lightweight one (Hawker) —
    // never both at once. Online is freely combinable with either.
    public static bool IsValidCombination(IEnumerable<string> channels)
    {
        var set = channels as ICollection<string> ?? channels.ToList();
        return !(set.Contains(Pos) && set.Contains(Hawker));
    }

    public static string[] ParseJson(string? json) =>
        string.IsNullOrWhiteSpace(json) ? [] : JsonSerializer.Deserialize<string[]>(json) ?? [];

    public static string ToJson(IEnumerable<string> salesChannels) =>
        JsonSerializer.Serialize(salesChannels);
}

public static class ShopTypes
{
    public const string BigSupershop = "BIG_SUPERSHOP";
    public const string SmallShowroom = "SMALL_SHOWROOM";
    public const string HawkerShop = "HAWKER_SHOP";

    public static readonly IReadOnlySet<string> All = new HashSet<string>
    {
        BigSupershop,
        SmallShowroom,
        HawkerShop
    };

    public static string? FromChannels(IEnumerable<string> channels)
    {
        var set = channels as ICollection<string> ?? channels.ToList();
        if (set.Contains(SalesChannels.Pos)) return BigSupershop;
        if (set.Contains(SalesChannels.Hawker)) return HawkerShop;
        return null;
    }

    public static bool MatchesChannels(string shopType, IEnumerable<string> channels)
    {
        var set = channels as ICollection<string> ?? channels.ToList();
        return shopType switch
        {
            BigSupershop => set.Contains(SalesChannels.Pos) && !set.Contains(SalesChannels.Hawker),
            SmallShowroom or HawkerShop => set.Contains(SalesChannels.Hawker) && !set.Contains(SalesChannels.Pos),
            _ => false
        };
    }
}
