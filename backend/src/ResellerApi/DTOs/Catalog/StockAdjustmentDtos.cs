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
