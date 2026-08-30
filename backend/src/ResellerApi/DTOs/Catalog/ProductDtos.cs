namespace ResellerApi.DTOs.Catalog;

public record ActiveCategoryDto(Guid Id, string Name);

// One bucket in the product sales graph — PeriodStart is a day (7d/30d ranges) or the start of a
// 7-day bucket (90d/180d ranges); see ProductService.GetSalesTimeseriesAsync. Revenue/Profit are
// attributed to just this product's line items (Qty*UnitPrice / Qty*(UnitPrice-UnitCostSnapshot)),
// not the whole order — delivery charges/discounts are order-level, not product-level, so they're
// deliberately left out of a per-product number. Owner/Manager only (GTR-10: STAFF never sees
// cost/profit), enforced by the [Authorize(Roles = Roles.OwnerOrManager)] on the endpoint itself.
// Channels is this same bucket split out per Order.Channel (FACEBOOK/WHATSAPP/SHOP/...) — the
// chart uses the bucket-level Qty/Revenue/Profit as-is, the sales history table flattens
// Channels into one row per bucket+channel instead, since a single day can span several channels.
public record ProductSalesPointDto(DateOnly PeriodStart, decimal Qty, decimal Revenue, decimal Profit, List<ProductSalesChannelDto> Channels);

public record ProductSalesChannelDto(string Channel, decimal Qty, decimal Revenue, decimal Profit);

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
    int LowStockThreshold,
    decimal BuyPrice,              // OWNER only — default variant's landed cost
    decimal? AverageRating,
    int ReviewCount,
    int OrderCount,
    decimal TotalProfit,           // OWNER only
    bool ShowOnMarketplace,
    decimal? WholesaleMinQty,      // both null = no wholesale tier for this product
    decimal? WholesaleUnitPrice
);

public record ProductMarketplaceDetailDto(Guid Id, string Section, string Label, string Value, int SortOrder);

public record MarketplaceDetailTemplateLabelDto(string Section, string Label, string? ValuePlaceholder, int SortOrder);

public record ProductImageDto(Guid Id, string ImageUrl, int SortOrder);

public record ProductDetailDto(
    Guid Id,
    Guid CategoryId,
    string Name,
    string Sku,
    string? ImageUrl,
    string ImageSource,
    Guid? SuggestedProductId,
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
    string? WarrantyDurationUnit,
    decimal? AverageRating,
    int ReviewCount,
    decimal? WholesaleMinQty,
    decimal? WholesaleUnitPrice,
    string? WholesaleNote
);

public record ProductDetailStaffDto(
    Guid Id,
    Guid CategoryId,
    string Name,
    string Sku,
    string? ImageUrl,
    string ImageSource,
    Guid? SuggestedProductId,
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
    string? WarrantyDurationUnit,
    decimal? AverageRating,
    int ReviewCount,
    decimal? WholesaleMinQty,
    decimal? WholesaleUnitPrice,
    string? WholesaleNote
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
    decimal? MarketPrice,
    decimal? WholesaleMinQty,
    decimal? WholesaleUnitPrice,
    Guid CategoryId
);

// Hawker night-entry tile grid — qty AND revenue sold today for a variant, at the actual price
// each sale went through at (not today's listed price, which Night Entry lets a seller override
// per sale).
public record TodaySoldDto(decimal Qty, decimal Amount);

// Variant field values (marked IsVariant) plus the opening quantity + cost owned for that
// specific combination — every variant a product starts with gets its own cost basis up front.
public record VariantCombinationInput(
    Dictionary<string, string> Values,
    decimal Qty,
    decimal CostPrice
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
    // Null → a single bare variant with no stock/cost yet — used only by internal bulk-add
    // flows (e.g. Quick Add from suggested categories) that have their own separate opening-
    // stock path. Non-null → the normal New Product screen path: one entry per variant, each
    // with a required opening quantity + cost, validated in ProductService.CreateAsync.
    List<VariantCombinationInput>? VariantCombinations,
    Guid? BranchId,
    int? WarrantyDurationValue,
    string? WarrantyDurationUnit,
    // Both null = no wholesale (পাইকারি) tier. Both must be set together, WholesaleMinQty >= 2,
    // WholesaleUnitPrice < SellingPrice — validated in ProductService.
    decimal? WholesaleMinQty,
    decimal? WholesaleUnitPrice,
    string? WholesaleNote
);

// "I already have this stock" — for a variant that has never had any real purchase cost
// recorded (AvgLandedCost == 0). Only usable once per variant in that state; once real cost
// exists, restocking goes through the normal Purchases flow instead. See
// ProductService.RecordExistingStockCostAsync.
public record RecordExistingStockCostRequest(
    decimal Qty,
    decimal CostPerUnit,
    Guid? BranchId
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
    string? WarrantyDurationUnit,
    decimal? WholesaleMinQty,
    decimal? WholesaleUnitPrice,
    string? WholesaleNote
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
    bool IsDefault,
    // A new variant always needs its own opening quantity + cost, same as at product creation —
    // it can never be added with an unknown cost basis.
    decimal Qty,
    decimal CostPrice,
    Guid? BranchId
);

// Redistributes a single variant's existing on-hand stock into several new variants — no new
// cost entry, since it's the same physical batch just being recategorized (e.g. a product added
// without a size/color matrix, now being split into real variants). See
// ProductService.SplitStockIntoVariantsAsync.
public record SplitVariantItem(Dictionary<string, string> Values, decimal Qty);

public record SplitStockIntoVariantsRequest(
    Guid SourceVariantId,
    List<SplitVariantItem> Items,
    Guid? BranchId
);

public record UpdateVariantRequest(
    string? ImageUrl,
    string? Note,
    decimal? PriceOverride,
    bool IsDefault,
    byte[] RowVer
);
