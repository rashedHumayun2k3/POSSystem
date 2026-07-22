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
    string? NameBn,
    string? DefaultUnit,
    List<CategoryFieldDto> Fields,
    Guid? ParentCategoryId,
    string? ParentCategoryName,
    string? ParentCategoryNameBn
);

public record UpsertCategoryRequest(
    string Name,
    string? NameBn,
    string? DefaultUnit,
    Guid? ParentCategoryId
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
