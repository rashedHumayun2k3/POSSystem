namespace ResellerApi.DTOs.Catalog;

public record ActiveCategoryDto(Guid Id, string Name);

// ── Variant DTOs ─────────────────────────────────────────────────────────────

public record VariantDto(
    Guid Id,
    string VariantValuesJson,
    string Sku,
    string Barcode,
    string? ImageUrl,          // null = falls back to the product's shared photo
    string? Note,
    decimal? PriceOverride,
    bool IsDefault,
    decimal AvgLandedCost,     // OWNER only — stripped from STAFF responses
    decimal Stock,             // OWNER only — current on-hand in the active branch scope
    byte[] RowVer
);

public record VariantStaffDto(
    Guid Id,
    string VariantValuesJson,
    string Sku,
    string Barcode,
    string? ImageUrl,
    string? Note,
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
    decimal? MarketplacePrice,
    decimal PackagingCostPerUnit,  // OWNER only
    string Status,
    string CategoryName,
    int VariantCount,
    int TotalStock,
    int LowStockThreshold
);

public record ProductMarketplaceDetailDto(Guid Id, string Section, string Label, string Value, int SortOrder);

public record MarketplaceDetailTemplateLabelDto(string Section, string Label);

public record ProductImageDto(Guid Id, string ImageUrl, int SortOrder);

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
    decimal? MarketplacePrice,
    decimal PackagingCostPerUnit,  // OWNER only
    int LowStockThreshold,
    string? AttributesJson,
    string? Note,
    string Status,
    string CategoryName,
    List<VariantDto> Variants,      // OWNER only — STAFF gets VariantStaffDto list
    byte[] RowVer,
    bool ShowOnMarketplace,         // OWNER only — controls ClientPage marketplace visibility
    string? YoutubeUrl,
    List<ProductMarketplaceDetailDto> MarketplaceDetails,
    List<ProductImageDto> Images,
    int? WarrantyDurationValue,
    string? WarrantyDurationUnit
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
    decimal? MarketplacePrice,
    int LowStockThreshold,
    string? AttributesJson,
    string? Note,
    string Status,
    string CategoryName,
    List<VariantStaffDto> Variants,
    string? YoutubeUrl,
    List<ProductMarketplaceDetailDto> MarketplaceDetails,
    List<ProductImageDto> Images,
    int? WarrantyDurationValue,
    string? WarrantyDurationUnit
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
    decimal AvgLandedCost,
    decimal? MarketPrice
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
    List<Dictionary<string, string>>? VariantCombinations,
    // Optional "I already own this" entry — only applied when the product has exactly one
    // variant (no VariantCombinations); ignored for multi-variant products, where per-variant
    // stock must go through the normal Stock Adjustment flow instead. Silently records an
    // OPENING_BALANCE purchase trip behind the scenes — see ProductService.CreateAsync.
    decimal? InitialStock,
    decimal? CostPrice,
    Guid? BranchId,
    int? WarrantyDurationValue,
    string? WarrantyDurationUnit
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
    byte[] RowVer,
    int? WarrantyDurationValue,
    string? WarrantyDurationUnit
);

public record SetProductMarketplaceVisibilityRequest(bool Show);

public record UpsertMarketplaceDetailItem(string Section, string Label, string Value, int SortOrder);

public record UpdateMarketplaceDetailsRequest(string? YoutubeUrl, List<UpsertMarketplaceDetailItem> Details, decimal? MarketplacePrice);

public record AddProductImageRequest(string ImageUrl);

public record ReorderProductImagesRequest(List<Guid> ImageIdsInOrder);

public record CreateVariantRequest(
    string VariantValuesJson,
    string? Barcode,           // if null, auto-generate
    string? ImageUrl,
    string? Note,
    decimal? PriceOverride,
    bool IsDefault
);

public record UpdateVariantRequest(
    string? ImageUrl,
    string? Note,
    decimal? PriceOverride,
    bool IsDefault,
    byte[] RowVer
);
