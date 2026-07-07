using System.Text.Json;

namespace ResellerApi.Infrastructure;

// How the business sells, distinct from BusinessTypes (which is industry/product category).
public static class SalesChannels
{
    public const string Pos    = "POS";
    public const string Hawker = "HAWKER";
    public const string Online = "ONLINE";

    public static readonly IReadOnlySet<string> All = new HashSet<string> { Pos, Hawker, Online };

    public static string[] ParseJson(string? json) =>
        string.IsNullOrWhiteSpace(json) ? [] : JsonSerializer.Deserialize<string[]>(json) ?? [];

    public static string ToJson(IEnumerable<string> salesChannels) =>
        JsonSerializer.Serialize(salesChannels);
}
