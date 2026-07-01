namespace ResellerApi.DTOs.Orders;

// ── Customer DTOs ─────────────────────────────────────────────────────────────

public record CustomerSummaryDto(
    Guid Id,
    string Name,
    string Phone,
    string? Address,
    decimal CreditLimit,
    decimal StoreCreditBalance,
    bool IsRejecterFlag,
    int OrderCount,
    decimal UnpaidBalance
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
    Guid? CourierId
);

public record UpdateOrderRequest(
    string? CustomerName,
    string? CustomerAddress,
    string? Channel,
    string? DiscountType,
    decimal? DiscountValue,
    decimal? DeliveryChargeCustomer,
    string? Note,
    Guid? CourierId
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

public record AddOrderPaymentRequest(
    string Method,
    decimal Amount,
    DateTime? ReceivedAt
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
    bool IsDamagedItem
);

public record OrderPaymentDto(
    Guid Id,
    string Method,
    decimal Amount,
    DateTime ReceivedAt,
    string RecordedByName
);

public record OrderStatusHistoryDto(
    string Track,
    string FromStatus,
    string ToStatus,
    string UserName,
    DateTime At
);

public record OrderEconomicsDto(
    decimal Revenue,
    decimal Cost,
    decimal Profit,
    decimal DiscountAmount
);

public record OrderListDto(
    Guid Id,
    string OrderNo,
    string Channel,
    string CustomerName,
    string CustomerPhone,
    string OrderStatus,
    string PaymentStatus,
    string FulfillmentStatus,
    bool IsDraft,
    decimal TotalAmount,
    decimal DueAmount,
    string? TrackingNo,
    string? HandlingUserName,
    DateTime CreatedAt
);

public record OrderDetailDto(
    Guid Id,
    string OrderNo,
    string Channel,
    Guid? CustomerId,
    string CustomerName,
    string CustomerPhone,
    string? CustomerAddress,
    string OrderStatus,
    string PaymentStatus,
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
    OrderEconomicsDto? Economics
);
