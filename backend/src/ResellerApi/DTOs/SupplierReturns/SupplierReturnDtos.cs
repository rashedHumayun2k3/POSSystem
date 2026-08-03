namespace ResellerApi.DTOs.SupplierReturns;

public record SupplierReturnListDto(
    Guid Id,
    string SupplierReturnNo,
    Guid SupplierId,
    string SupplierName,
    Guid? TripId,
    string? TripNo,
    string Status,
    int ItemCount,
    decimal TotalQty,
    decimal TotalValue,
    DateTime CreatedAt
);

public record SupplierReturnItemDto(
    Guid Id,
    Guid VariantId,
    string VariantSku,
    string ProductName,
    string UnitCode,
    decimal QtyReturned,
    decimal UnitCost,
    string ResolutionType,
    decimal? ResolutionAmount,
    Guid? ReplacementTripId,
    string? ReplacementTripNo,
    string? Note
);

public record SupplierReturnDetailDto(
    Guid Id,
    string SupplierReturnNo,
    Guid? BranchId,
    Guid SupplierId,
    string SupplierName,
    string? SupplierAddress,
    Guid? TripId,
    string? TripNo,
    string Status,
    string? Note,
    Guid CreatedBy,
    string CreatedByName,
    DateTime CreatedAt,
    Guid? ResolvedBy,
    string? ResolvedByName,
    DateTime? ResolvedAt,
    List<SupplierReturnItemDto> Items
);

public record CreateSupplierReturnRequest(Guid SupplierId, Guid? TripId, Guid? BranchId, string? Note);

public record AddSupplierReturnItemRequest(
    Guid VariantId,
    decimal QtyReturned,
    decimal UnitCost,
    string ResolutionType,
    decimal? ResolutionAmount,
    Guid? ReplacementTripId,
    string? Note
);

public record UpdateSupplierReturnItemRequest(
    decimal QtyReturned,
    decimal UnitCost,
    string ResolutionType,
    decimal? ResolutionAmount,
    Guid? ReplacementTripId,
    string? Note
);

// What's actually left to claim right now: on-hand Damaged minus whatever's already committed to
// an open (DRAFT/SUBMITTED) return for that variant — so the same unit can't be added twice.
public record DamagedStockItemDto(
    Guid VariantId,
    string VariantSku,
    string ProductName,
    string UnitCode,
    decimal DamagedQty,
    decimal AvgLandedCost
);
