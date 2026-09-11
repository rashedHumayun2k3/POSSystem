namespace ResellerApi.DTOs.Purchases;

// ── Requests ──────────────────────────────────────────────────────────────────

public record CreatePurchaseTripRequest(
    string SourceType,
    string? Note,
    Guid? BranchId = null
);

public record AddPurchaseItemRequest(
    Guid VariantId,
    decimal QtyBought,
    decimal TotalCost,
    Guid? SupplierId,
    string? MemoPhotoUrl,
    decimal PaidNow,
    decimal DueAmount,
    DateTime? PromisedDate,
    decimal UnitWeightGrams = 0
);

public record UpdatePurchaseItemRequest(
    decimal QtyBought,
    decimal TotalCost,
    Guid? SupplierId,
    string? MemoPhotoUrl,
    decimal PaidNow,
    decimal DueAmount,
    DateTime? PromisedDate,
    decimal UnitWeightGrams = 0
);

public record AddPurchaseTripCostRequest(
    string CostType,
    decimal Amount,
    string? Note,
    string? PhotoUrl,
    string? PaidBy
);

// ── Receive session requests ───────────────────────────────────────────────────

public record SessionItemInput(
    Guid PurchaseItemId,
    decimal QtyUsable,
    decimal QtyDamaged,
    string PerLotValuesJson,
    decimal QtyMissing = 0
);

public record PurchaseReceiveAttachmentDto(
    string Name,
    string Url,
    string ContentType,
    long SizeBytes
);

public record CreateReceiveSessionRequest(
    DateTime ReceivedAt,
    string TransportMode,
    string? VehicleOrTrackingNo,
    string? Note,
    List<SessionItemInput> Items,
    List<PurchaseReceiveAttachmentDto>? Attachments = null
);

public record RejectSessionRequest(string? Reason);

// ── Close-trip request (replaces the old CompleteAsync per-item flow) ─────────

public record CloseTripRequest(
    bool ForceClose = false,
    string? ForceCloseReason = null
);

public record UpdateTripHeaderRequest(
    DateTime? ExpectedDeliveryDate,
    string? SupplierPoRef
);

// ── Responses ─────────────────────────────────────────────────────────────────

public record PurchaseTripSummaryDto(
    Guid Id,
    string TripNo,
    string SourceType,
    string Status,
    int ItemCount,
    decimal TotalQtyBought,
    decimal TotalQtyUsable,
    decimal TotalQtyDamaged,
    decimal TotalItemCost,
    decimal TotalSharedCost,
    DateTime CreatedAt,
    string? SupplierReturnStatus // status of the most recent supplier return linked to this trip, if any
);

public record PurchaseItemDto(
    Guid Id,
    Guid VariantId,
    string VariantSku,
    string ProductName,
    string UnitCode,
    decimal QtyBought,
    decimal QtyUsable,
    decimal QtyDamaged,
    decimal TotalCost,
    decimal UnitWeightGrams,
    Guid? SupplierId,
    string? SupplierName,
    string? SupplierAddress,
    string? MemoPhotoUrl,
    decimal PaidNow,
    decimal DueAmount,
    DateTime? PromisedDate,
    decimal AllocatedSharedCost,
    decimal LandedUnitCost,
    // The most recent supplier return (if any) that has claimed damaged units of this variant
    // on this trip — lets the UI hide "Add for return" once it's already been submitted, and
    // link straight to that return instead.
    Guid? SupplierReturnId,
    string? SupplierReturnNo,
    string? SupplierReturnStatus,
    decimal? SupplierReturnQty,
    decimal QtyMissing = 0
);

public record PurchaseTripCostDto(
    Guid Id,
    string CostType,
    decimal Amount,
    string? Note,
    string? PhotoUrl,
    string? PaidBy,
    bool IsPostCompletion
);

public record PurchaseReceiveItemDto(
    Guid Id,
    Guid PurchaseItemId,
    decimal QtyUsable,
    decimal QtyDamaged,
    string? PerLotValuesJson,
    decimal QtyMissing = 0
);

public record UpdateTripAttachmentsRequest(
    List<PurchaseReceiveAttachmentDto> Attachments
);

public record PurchaseReceiveSessionDto(
    Guid Id,
    string SessionNo,
    Guid ReceivedBy,
    string ReceivedByName,
    DateTime ReceivedAt,
    string TransportMode,
    string? VehicleOrTrackingNo,
    string? Note,
    string Status,
    Guid? ApprovedBy,
    string? ApprovedByName,
    DateTime? ApprovedAt,
    string? RejectionReason,
    List<PurchaseReceiveItemDto> Items,
    List<PurchaseReceiveAttachmentDto> Attachments
);

public record PurchaseTripDetailDto(
    Guid Id,
    string TripNo,
    string SourceType,
    string Status,
    string? Note,
    DateTime? ExpectedDeliveryDate,
    string? SupplierPoRef,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    string? ForceCloseReason,
    List<PurchaseItemDto> Items,
    List<PurchaseTripCostDto> Costs,
    List<PurchaseReceiveSessionDto> Sessions,
    List<PurchaseReceiveAttachmentDto> Attachments
);

public record LandedCostPreviewDto(
    Guid PurchaseItemId,
    string ProductName,
    string VariantSku,
    decimal QtyUsable,
    decimal TotalCost,
    decimal AllocatedSharedCost,
    decimal LandedUnitCost,
    decimal CurrentAvgCost,
    decimal NewAvgCost
);

public record CompleteTripPreviewDto(
    decimal TotalSharedCost,
    List<LandedCostPreviewDto> Items
);
