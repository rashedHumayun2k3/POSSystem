namespace ResellerApi.DTOs.Cartons;

// ── Requests ──────────────────────────────────────────────────────────────────

public record BulkCreateCartonsRequest(
    Guid TripId,
    int Count,                  // number of cartons to auto-generate (C-01 … C-N)
    string? LocationPrefix,     // optional common location for all
    List<string>? CustomNos     // optional override list; if null, auto-generate
);

public record UpdateCartonRequest(
    string? CartonNo,
    string? Location,
    string? Notes
);

public record OpenCartonRequest(
    string? Location,
    string? Notes,
    List<CartonItemInput> Items
);

public record CartonItemInput(
    Guid VariantId,
    decimal QtyInCarton,
    decimal QtyDamaged,
    decimal LabelPrice          // selling price for this label batch
);

public record LabelCartonItemRequest(decimal QtyNowLabeled);   // qty being labeled in this print run

// ── Responses ─────────────────────────────────────────────────────────────────

public record CartonSummaryDto(
    Guid Id,
    string CartonNo,
    Guid TripId,
    string TripNo,
    string Status,
    string? Location,
    string? Notes,
    DateTime CreatedAt,
    DateTime? OpenedAt,
    int ItemCount,
    decimal TotalQtyInCarton,
    decimal TotalLabeled,
    decimal TotalDamaged
);

public record CartonDetailDto(
    Guid Id,
    string CartonNo,
    Guid TripId,
    string TripNo,
    string Status,
    string? Location,
    string? Notes,
    DateTime CreatedAt,
    DateTime? OpenedAt,
    List<CartonItemDto> Items
);

public record CartonItemDto(
    Guid Id,
    Guid VariantId,
    string VariantSku,
    string ProductName,
    string VariantValues,
    string? Barcode,
    decimal QtyInCarton,
    decimal QtyLabeled,
    decimal QtyDamaged,
    decimal LabelPrice,
    decimal QtyRemaining       // QtyInCarton - QtyLabeled - QtyDamaged
);

public record StoreroomSummaryDto(
    int TotalCartons,
    int Sealed,
    int Opened,
    int Partial,
    int Done,
    decimal TotalUnitsInCartons,
    decimal TotalLabeled,
    decimal TotalDamaged
);

public record LocationLookupItemDto(
    Guid CartonId,
    string CartonNo,
    Guid TripId,
    string TripNo,
    string? Location,
    string Status,
    decimal QtyInCarton,
    decimal QtyLabeled,
    decimal QtyDamaged
);

public record DamagedItemDto(
    Guid CartonId,
    string CartonNo,
    Guid TripId,
    string TripNo,
    DateTime? OpenedAt,
    Guid VariantId,
    string ProductName,
    string VariantSku,
    string VariantValues,
    decimal QtyDamaged
);

public record TripWithCartonsDto(
    Guid TripId,
    string TripNo,
    string TripStatus,
    DateTime CreatedAt,
    int CartonCount,
    int SealedCount,
    int DoneCount
);
