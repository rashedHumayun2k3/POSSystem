namespace ResellerApi.DTOs.Catalog;

public record PriceHistoryDto(
    Guid Id,
    decimal OldPrice,
    decimal NewPrice,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo,
    string ChangedByName,
    string Reason,
    bool IsScheduled,
    bool IsRevert
);

public record ChangePriceRequest(
    Guid VariantId,
    decimal NewPrice,
    string Reason,
    DateTime? EffectiveFrom,   // null = immediately
    DateTime? RevertAt         // null = no scheduled revert
);
