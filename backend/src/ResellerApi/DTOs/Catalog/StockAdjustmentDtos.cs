namespace ResellerApi.DTOs.Catalog;

// Mode "SET" — Value is the new actual on-hand count (a physical recount); the service computes
// the signed delta itself. Mode "DELTA" — Value is the signed change to apply directly (e.g. "-3"
// for 3 known-damaged units).
public record AdjustStockRequest(
    string Reason,      // EXISTING_STOCK | DAMAGED | LOST_THEFT | RECOUNT | FOUND_EXTRA | OTHER
    string Mode,        // SET | DELTA
    decimal Value,
    string? Note,
    Guid? BranchId
);

public record StockAdjustmentDto(
    Guid Id,
    string Reason,
    decimal Qty,        // signed delta actually applied
    string? Note,
    string UserName,
    DateTime CreatedAt
);

// Product stock timeline (newest first). AffectsStock=false for damaged-unit events: damaged units
// are kept in a separate count and never part of sellable stock.
public record StockHistoryEntryDto(
    Guid Id,
    string MovementType,
    string Reason,
    decimal Qty,
    bool AffectsStock,
    decimal BalanceAfter,
    string? Note,
    string? UserName,
    DateTime CreatedAt,
    string? RefKind,      // PO | ORDER | null
    Guid? RefId,
    string? RefNo,
    string? Tag);         // DAMAGED | null

public record StockHistoryDto(
    decimal OnHand,
    decimal Committed,
    decimal Damaged,
    decimal OpeningWithoutHistory,   // stock that existed before any recorded movement (old/seed data)
    List<StockHistoryEntryDto> Entries);
