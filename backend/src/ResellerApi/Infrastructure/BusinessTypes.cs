using System.Text.Json;

namespace ResellerApi.Infrastructure;

public static class BusinessTypes
{
    public const string ClothingFashion    = "CLOTHING_FASHION";
    public const string CosmeticsBeauty    = "COSMETICS_BEAUTY";
    public const string ElectronicsGadgets = "ELECTRONICS_GADGETS";
    public const string ShoesFootwear      = "SHOES_FOOTWEAR";
    public const string BagsAccessories    = "BAGS_ACCESSORIES";
    public const string ToysBaby           = "TOYS_BABY";
    public const string HomeKitchen        = "HOME_KITCHEN";
    public const string BooksStationery    = "BOOKS_STATIONERY";
    public const string Other              = "OTHER";

    public static readonly IReadOnlySet<string> All = new HashSet<string>
    {
        ClothingFashion, CosmeticsBeauty, ElectronicsGadgets, ShoesFootwear,
        BagsAccessories, ToysBaby, HomeKitchen, BooksStationery, Other
    };

    public static string[] ParseJson(string? json) =>
        string.IsNullOrWhiteSpace(json) ? [] : JsonSerializer.Deserialize<string[]>(json) ?? [];

    public static string ToJson(IEnumerable<string> businessTypes) =>
        JsonSerializer.Serialize(businessTypes);
}
