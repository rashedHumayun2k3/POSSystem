namespace ResellerApi.DTOs.CatalogTemplates;

public record SuggestedCategoryDto(
    Guid Id,
    string BusinessTypeCode,
    string Name,
    string DefaultUnit,
    bool AlreadyAdded
);

public record AddSuggestedCategoriesRequest(List<Guid> SuggestedCategoryIds);

public record CategoryWithSuggestionsDto(
    Guid CategoryId,
    string Name,
    int AvailableSuggestionCount
);

public record SuggestedProductDto(
    Guid Id,
    string Name,
    bool AlreadyAdded,
    decimal? ExistingSellingPrice,
    decimal? ExistingQuantity
);

// Quantity + UnitCost are always required — every product added through Quick Add gets a real
// cost basis, same rule as New Product and Add Variant. SellingPrice stays optional.
public record QuickAddProductItem(
    string Name,
    decimal? SellingPrice,
    decimal Quantity,
    decimal UnitCost
);

public record AddSuggestedProductsRequest(
    Guid CategoryId,
    Guid? BranchId,
    List<QuickAddProductItem> Items
);

public record AddSuggestedProductsResultItem(
    Guid ProductId,
    string Name,
    bool StockAdded
);
