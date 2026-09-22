namespace ResellerApi.DTOs.Orders;

// ── Customer DTOs ─────────────────────────────────────────────────────────────

public record CustomerSummaryDto(
    Guid Id,
    string Name,
    string Phone,
    string? Address,
    decimal CreditLimit,
    decimal StoreCreditBalance,
    // Computed from actual recent order outcomes (2+ returns in the last 4 orders) — supersedes
    // the old manually-set IsRejecterFlag column, which nothing ever set outside seed data.
    bool IsSerialRejecter,
    int RecentReturnCount,
    int RecentOrderCount,
    int OrderCount,
    int ReturnCount,
    DateTime? LastOrderAt,
    decimal UnpaidBalance
);

// Deliberately excludes CreditLimit/StoreCreditBalance/UnpaidBalance and every order-history
// field — this is the shape synced down to an offline POS device's local cache (GTR-10 territory:
// financial data stays server-side, only identity/contact fields needed to attach an existing
// customer to a sale get cached).
public record CustomerCacheDto(
    Guid Id,
    string Name,
    string Phone,
    string? Address
);

public record UpdateCustomerRequest(
    string Name,
    string? Address,
    decimal? CreditLimit,
    string? Note
);

// ── Courier DTOs ──────────────────────────────────────────────────────────────

public record CourierDto(
    Guid Id,
    string Name,
    decimal InsideDhakaCharge,
    decimal OutsideDhakaCharge,
    decimal ReturnCharge,
    string CodFeeType,
    decimal CodFeeValue,
    string? Contact,
    string? TrackingUrlTemplate,
    bool IsActive
);

public record CreateCourierRequest(
    string Name,
    decimal InsideDhakaCharge,
    decimal OutsideDhakaCharge,
    decimal ReturnCharge,
    string CodFeeType,
    decimal CodFeeValue,
    string? Contact,
    string? TrackingUrlTemplate
);

public record UpdateCourierRequest(
    string Name,
    decimal InsideDhakaCharge,
    decimal OutsideDhakaCharge,
    decimal ReturnCharge,
    string CodFeeType,
    decimal CodFeeValue,
    string? Contact,
    string? TrackingUrlTemplate,
    bool IsActive
);

public record DeliveryManDto(
    Guid Id,
    string Name,
    string Phone,
    Guid? CourierId,
    string? CourierName,
    decimal CostPerDelivery,
    bool IsActive
);

public record CreateDeliveryManRequest(
    string Name,
    string Phone,
    Guid? CourierId,
    decimal CostPerDelivery
);

public record UpdateDeliveryManRequest(
    string Name,
    string Phone,
    Guid? CourierId,
    decimal CostPerDelivery,
    bool IsActive
);

// ── Order request DTOs ────────────────────────────────────────────────────────

public record OrderItemInput(
    Guid VariantId,
    decimal Qty,
    decimal UnitPrice
);

public record CreateOrderRequest(
    string Channel,
    string CustomerPhone,
    string CustomerName,
    string? CustomerAddress,
    bool IsDraft,
    List<OrderItemInput> Items,
    string? DiscountType,
    decimal? DiscountValue,
    decimal DeliveryChargeCustomer,
    decimal AdvancePaid,
    string? AdvancePaymentMethod,
    string? Note,
    string? ClientUid,
    Guid? CourierId,
    DateOnly? BusinessDate = null, // backdatable — e.g. hawker night-entry logging an earlier day's sale
    // R3.3: a sale that happened offline is accepted even if it drives stock negative on sync,
    // rather than rejected — set only by the offline-sync replay path, never by a live/online
    // create. See ConfirmInternalAsync.
    bool AllowOversell = false,
    // Explicit branch this order is for — takes priority over the ambient X-Branch-Id header when
    // provided. Lets the New Order builder pin a branch up front and keep every item check/submit
    // against that same branch even if the header switcher changes underneath it mid-session
    // (same override pattern as StockAdjustmentService.ResolveBranchIdAsync).
    Guid? BranchId = null,
    string? Source = null,
    string? ExternalSource = null,
    string? ExternalOrderId = null,
    string? PaymentTerms = null,
    string? AdvancePaymentReference = null
);

public record UpdateOrderRequest(
    string? CustomerName,
    string? CustomerPhone,
    string? CustomerAddress,
    string? Channel,
    string? DiscountType,
    decimal? DiscountValue,
    decimal? DeliveryChargeCustomer,
    string? Note,
    Guid? CourierId,
    // Draft-only full item replacement (add/remove/re-qty/re-price) — null means "leave items
    // alone". Never accepted once the order is confirmed: stock is already committed by then and
    // GTR-8 freezes the order snapshot, so item changes past that point go through Revise instead.
    List<OrderItemInput>? Items = null
);

public record HandoverOrderRequest(
    Guid CourierId,
    string TrackingNo,
    Guid? DeliveryManId,
    decimal DeliveryCostActual
);

public record ReturnItemInput(
    Guid OrderItemId,
    decimal Qty,
    string Inspection  // SELLABLE | DAMAGED
);

public record ReturnOrderRequest(
    List<ReturnItemInput> Items,
    string ResolutionType,        // COURIER_RETURN | REFUND | STORE_CREDIT | REPLACE_SAME | EXCHANGE_DIFFERENT
    string? Reason,               // DEFECTIVE | WRONG_SIZE_COLOR | CHANGED_MIND | DAMAGED_DELIVERY | OTHER
    decimal? RefundAmount,        // required for REFUND and STORE_CREDIT
    string? RefundMethod,         // CASH | BKASH | NAGAD — for REFUND only
    string? Note
);

public record CancelOrderRequest(string Reason);
public record DeleteOrderRequest(string Reason);

// ── Revise (reduce/remove line items, pre-fulfillment) ─────────────────────────

public record ReviseOrderItemInput(
    Guid OrderItemId,
    decimal NewQty   // 0 = remove the line entirely; must be < the item's current Qty (reduce-only)
);

public record ReviseOrderRequest(
    List<ReviseOrderItemInput> Items,
    string Reason,                // OUT_OF_STOCK | CUSTOMER_CHANGED_MIND | OTHER
    string? Note,                 // required when Reason == OTHER
    // Only required if the revised total would leave TotalPaid > new TotalAmount — the service
    // rejects with OrderOverpaidException(excess) first so the client can prompt for these and
    // resubmit the same request with them filled in. The refunded/credited amount is always the
    // server-computed excess, never a client-supplied figure.
    string? ResolutionType,       // REFUND | STORE_CREDIT
    string? RefundMethod          // CASH | BKASH | NAGAD — required when ResolutionType == REFUND
);

public record AddOrderPaymentRequest(
    string Method,
    decimal Amount,
    DateTime? ReceivedAt,
    string? PaymentReference = null
);

// ── Order response DTOs ───────────────────────────────────────────────────────

public record OrderItemDto(
    Guid Id,
    Guid VariantId,
    string VariantSku,
    string ProductName,
    string? VariantLabel,
    decimal Qty,
    decimal UnitPrice,
    decimal Subtotal,
    // owner-only — null for STAFF
    decimal? UnitCostSnapshot,
    decimal? LineProfit,
    bool IsDamagedItem,
    // Current available stock (OnHand - Committed - Damaged) at the order's branch, at read
    // time — same field/semantics as OrderListItemSummaryDto.AvailableStock.
    decimal AvailableStock
);

public record OrderPaymentDto(
    Guid Id,
    string Method,
    decimal Amount,
    DateTime ReceivedAt,
    string RecordedByName,
    string? PaymentReference = null
);

public record OrderStatusHistoryDto(
    string Track,
    string FromStatus,
    string ToStatus,
    string UserName,
    DateTime At,
    // Only populated for Track="ITEMS" (order revision) rows
    string? Reason,
    string? Note
);

public record OrderEconomicsDto(
    decimal Revenue,
    decimal Cost,
    decimal Profit,
    decimal DiscountAmount
);

public record OrderListItemSummaryDto(
    string ProductName,
    string VariantSku,
    decimal Qty,
    // Current available stock (OnHand - Committed - Damaged) at the order's branch, at read
    // time — lets staff see at a glance whether a not-yet-confirmed order can actually be
    // fulfilled before they call the customer to confirm it.
    decimal AvailableStock,
    // Lets a product-detail page (e.g. ListByProductAsync) pick out just this order's line(s)
    // for the specific product it's already scoped to, without matching on name.
    Guid ProductId,
    string? ImageUrl = null
);

public record OrderManagementPageDto(List<OrderListDto> Items, Dictionary<string, int> Counts, int TotalCount, int Page, int PageSize);

public record OrderListDto(
    Guid Id,
    string OrderNo,
    string Channel,
    string? Source,
    string? ExternalSource,
    string? ExternalOrderId,
    string CustomerName,
    string CustomerPhone,
    string OrderStatus,
    string PaymentStatus,
    string PaymentTerms,
    string FulfillmentStatus,
    bool IsDraft,
    decimal TotalAmount,
    decimal DueAmount,
    string? TrackingNo,
    string? HandlingUserName,
    DateTime CreatedAt,
    DateOnly BusinessDate,
    List<OrderListItemSummaryDto> Items,
    decimal? Profit, // owner/manager only — null for STAFF, mirrors OrderDetailDto.Economics gating
    bool IsRevised,
    Guid? CourierId,
    string? CourierName,
    DateTime? HandedOverAt, // used to compute "days in transit" on the delivery board
    string? CustomerAddress, // frozen snapshot on the order itself, not a live Customer lookup (GTR-8)
    Guid? BranchId,
    string? BranchName
);

public record OrderDetailDto(
    Guid Id,
    string OrderNo,
    string Channel,
    string? Source,
    string? ExternalSource,
    string? ExternalOrderId,
    Guid? CustomerId,
    string CustomerName,
    string CustomerPhone,
    string? CustomerAddress,
    string OrderStatus,
    string PaymentStatus,
    string PaymentTerms,
    string FulfillmentStatus,
    bool IsDraft,
    string? DiscountType,
    decimal? DiscountValue,
    decimal DeliveryChargeCustomer,
    decimal DeliveryCostActual,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TotalAmount,
    decimal TotalPaid,
    decimal DueAmount,
    Guid? CourierId,
    string? CourierName,
    string? TrackingNo,
    Guid? DeliveryManId,
    string? DeliveryManName,
    Guid? HandlingUserId,
    string? HandlingUserName,
    string? Note,
    DateTime? ConfirmedAt,
    DateTime? HandedOverAt,
    DateTime? DeliveredAt,
    DateTime? ReturnedAt,
    string? CancelledReason,
    string? ReturnResolution,
    string? ReturnReason,
    string? ReturnNote,
    DateTime CreatedAt,
    string CreatedByName,
    List<OrderItemDto> Items,
    List<OrderPaymentDto> Payments,
    List<OrderStatusHistoryDto> StatusHistory,
    // owner-only — null for STAFF
    OrderEconomicsDto? Economics,
    bool IsRevised
);
