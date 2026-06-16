namespace ResellerApi.DTOs.Catalog;

public record ActiveCategoryDto(Guid Id, string Name);

// ── Variant DTOs ─────────────────────────────────────────────────────────────

public record VariantDto(
    Guid Id,
    string VariantValuesJson,
    string Sku,
    string Barcode,
    decimal? PriceOverride,
    bool IsDefault,
    decimal AvgLandedCost      // OWNER only — stripped from STAFF responses
);

public record VariantStaffDto(
    Guid Id,
    string VariantValuesJson,
    string Sku,
    string Barcode,
    decimal? PriceOverride,
    bool IsDefault
);

// ── Product DTOs ─────────────────────────────────────────────────────────────

public record ProductSummaryDto(
    Guid Id,
    string Name,
    string Sku,
    string? ImageUrl,
    string UnitCode,
    decimal SellingPrice,
    decimal? MarketPrice,
    decimal PackagingCostPerUnit,  // OWNER only
    string Status,
    string CategoryName,
    int VariantCount,
    int TotalStock
);

public record ProductDetailDto(
    Guid Id,
    Guid CategoryId,
    string Name,
    string Sku,
    string? ImageUrl,
    string? Description,
    string? DefectNotes,
    string UnitCode,
    decimal SellingPrice,
    decimal? MarketPrice,
    decimal PackagingCostPerUnit,  // OWNER only
    int LowStockThreshold,
    string? AttributesJson,
    string? Note,
    string Status,
    string CategoryName,
    List<VariantDto> Variants       // OWNER only — STAFF gets VariantStaffDto list
);

public record ProductDetailStaffDto(
    Guid Id,
    Guid CategoryId,
    string Name,
    string Sku,
    string? ImageUrl,
    string? Description,
    string? DefectNotes,
    string UnitCode,
    decimal SellingPrice,
    decimal? MarketPrice,
    int LowStockThreshold,
    string? AttributesJson,
    string? Note,
    string Status,
    string CategoryName,
    List<VariantStaffDto> Variants
);

public record ProductSearchResultDto(
    Guid Id,
    Guid VariantId,
    string Name,
    string Sku,
    string Barcode,
    decimal EffectivePrice,
    string? ImageUrl,
    string UnitCode,
    string VariantValuesJson,
    decimal Stock,
    decimal AvgLandedCost
);

public record CreateProductRequest(
    Guid CategoryId,
    string Name,
    string? ImageUrl,
    string? Description,
    string? DefectNotes,
    string UnitCode,
    decimal SellingPrice,
    decimal? MarketPrice,
    decimal PackagingCostPerUnit,
    int LowStockThreshold,
    string? AttributesJson,
    string? Note,
    // variant field values that are marked IsVariant — generate combinations
    List<Dictionary<string, string>>? VariantCombinations
);

public record UpdateProductRequest(
    Guid CategoryId,
    string Name,
    string? ImageUrl,
    string? Description,
    string? DefectNotes,
    string UnitCode,
    decimal SellingPrice,
    decimal? MarketPrice,
    decimal PackagingCostPerUnit,
    int LowStockThreshold,
    string? AttributesJson,
    string? Note,
    string Status,
    byte[] RowVer
);

public record CreateVariantRequest(
    string VariantValuesJson,
    string? Barcode,           // if null, auto-generate
    decimal? PriceOverride,
    bool IsDefault
);

public record UpdateVariantRequest(
    decimal? PriceOverride,
    bool IsDefault,
    byte[] RowVer
);
