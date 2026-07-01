namespace ResellerApi.DTOs.Catalog;

public record PriceSlotDto(
    Guid Id,
    string Label,
    decimal Price,
    string? Reason,
    bool IsActive,
    DateTime CreatedAt,
    string CreatedByName
);

public record PriceActivationLogDto(
    Guid Id,
    Guid SlotId,
    string LabelSnapshot,
    decimal PriceSnapshot,
    DateTime ActivatedAt,
    DateTime? DeactivatedAt,
    string ActivatedByName
);

public record CreateSlotRequest(
    string Label,
    decimal NewPrice,
    string? Reason
);
