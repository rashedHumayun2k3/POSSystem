namespace ResellerApi.DTOs.Catalog;

public record PriceSlotDto(
    Guid Id,
    string Label,
    decimal Price,
    string? Reason,
    bool IsActive,
    DateTime CreatedAt,
    string CreatedByName,
    DateTime StartDate,
    DateTime? EndDate
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
    string? Reason,
    // Null StartDate means "now" (service defaults it) — matches the existing behavior for every
    // slot created before scheduling existed. Null EndDate means no auto-expiry ("until changed").
    DateTime? StartDate = null,
    DateTime? EndDate = null
);
