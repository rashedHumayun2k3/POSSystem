namespace ResellerApi.DTOs.Suppliers;

public record SupplierDto(
    Guid Id,
    string Name,
    string? Address,
    string? Phone,
    string? Country,
    string? Notes,
    int UsageCount,
    DateTime? LastUsedAt
);

public record CreateSupplierRequest(
    string Name,
    string? Address,
    string? Phone,
    string? Notes,
    string? Country
);

public record UpdateSupplierRequest(
    string Name,
    string? Address,
    string? Phone,
    string? Notes,
    string? Country
);
