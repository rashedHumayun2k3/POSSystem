namespace ResellerApi.DTOs.ClientPage;

public record ClientPageCategoryDto(Guid Id, string Name, string? ImageUrl);

public record ClientPageShopDto(
    Guid Id,
    string Name,
    string? LogoUrl,
    string? Subdomain
);

public record ClientPageProductCardDto(
    Guid ProductId,
    Guid VariantId,
    string Name,
    string? ImageUrl,
    string UnitCode,
    decimal Price,
    string VariantValuesJson,
    bool InStock,
    Guid ShopId,
    string ShopName,
    double? AverageRating,
    int ReviewCount,
    decimal? MarketPrice,
    decimal? WholesaleMinQty, // both null = no wholesale tier for this product
    decimal? WholesaleUnitPrice
);

public record ClientPageVariantDto(
    Guid Id,
    string VariantValuesJson,
    decimal Price,
    bool InStock
);

public record ClientPageMarketplaceDetailDto(string Section, string Label, string Value);

public record ClientPageProductDetailDto(
    Guid Id,
    string Name,
    string? ImageUrl,
    string? Description,
    string UnitCode,
    decimal SellingPrice,
    string CategoryName,
    Guid ShopId,
    string ShopName,
    string? ShopSubdomain,
    List<ClientPageVariantDto> Variants,
    string? YoutubeUrl,
    List<ClientPageMarketplaceDetailDto> MarketplaceDetails,
    List<string> Images,
    int? WarrantyDurationValue,
    string? WarrantyDurationUnit,
    decimal? WholesaleMinQty,     // both null = no wholesale tier for this product
    decimal? WholesaleUnitPrice,
    string? WholesaleNote
);
