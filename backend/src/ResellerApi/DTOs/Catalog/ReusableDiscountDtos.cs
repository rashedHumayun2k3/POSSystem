namespace ResellerApi.DTOs.Catalog;

public record ReusableDiscountDto(
    Guid Id,
    string Name,
    decimal Percent,
    string? Reason,
    DateTime StartDate,
    DateTime? EndDate,
    DateTime CreatedAt,
    bool IsArchived,
    int AppliedVariantCount,
    int ActiveVariantCount = 0
);

public record CreateReusableDiscountRequest(
    string Name,
    decimal Percent,
    string? Reason,
    DateTime StartDate,
    DateTime? EndDate
);

public record UpdateReusableDiscountRequest(
    string Name,
    decimal Percent,
    string? Reason,
    DateTime StartDate,
    DateTime? EndDate
);

public record ApplyReusableDiscountRequest(
    bool AllProducts,
    Guid[]? CategoryIds,
    Guid[]? ProductIds
);

public record ApplyReusableDiscountResult(int ProductCount, int VariantCount, int ActivatedCount, int ScheduledCount);

public record AppliedDiscountVariantDto(
    Guid ProductId,
    string ProductName,
    Guid VariantId,
    string VariantSku,
    string VariantValuesJson,
    decimal OfferPrice,
    bool IsActive,
    DateTime StartDate,
    DateTime? EndDate,
    DateTime? RemovedAt
);

public record ActiveDiscountAssignmentDto(
    Guid DiscountId,
    string DiscountName,
    decimal Percent,
    bool IsArchived,
    Guid CategoryId,
    string CategoryName,
    Guid ProductId,
    string ProductName,
    Guid VariantId,
    string VariantSku,
    string VariantValuesJson,
    decimal OfferPrice
);
