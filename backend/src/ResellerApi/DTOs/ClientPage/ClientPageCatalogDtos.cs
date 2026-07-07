namespace ResellerApi.DTOs.ClientPage;

public record ClientPageCategoryDto(Guid Id, string Name);

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
    string ShopName
);

public record ClientPageVariantDto(
    Guid Id,
    string VariantValuesJson,
    decimal Price,
    bool InStock
);

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
    List<ClientPageVariantDto> Variants
);
