namespace ResellerApi.DTOs.Catalog;

public record CategoryFieldDto(
    Guid Id,
    string Name,
    string FieldType,
    string? OptionsJson,
    bool IsRequired,
    bool IsVariant,
    bool IsPerLot,
    int SortOrder
);

public record CategoryDto(
    Guid Id,
    string Name,
    string? DefaultUnit,
    List<CategoryFieldDto> Fields
);

public record UpsertCategoryRequest(
    string Name,
    string? DefaultUnit
);

public record UpsertCategoryFieldRequest(
    string Name,
    string FieldType,        // TEXT | NUMBER | DATE | DROPDOWN | BOOLEAN
    string? OptionsJson,
    bool IsRequired,
    bool IsVariant,
    bool IsPerLot,
    int SortOrder
);
