namespace ResellerApi.DTOs.Remittances;

public record CourierCodSummaryDto(
    Guid CourierId,
    string CourierName,
    int PendingOrderCount,
    decimal TotalCodReceivable,
    int RemittanceHistoryCount
);

public record OrderInCourierBoardDto(
    Guid OrderId,
    string OrderNo,
    string CustomerName,
    string CustomerPhone,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal CodAmount,
    string FulfillmentStatus,
    string? CodRemittanceStatus,
    DateTime? DeliveredAt,
    string? TrackingNo
);

public record CourierRemittanceDto(
    Guid Id,
    string RemittanceNo,
    Guid CourierId,
    string CourierName,
    decimal Amount,
    DateTime RemittedAt,
    string Method,
    string? Reference,
    string? Note,
    int OrderCount,
    string RecordedByName,
    DateTime CreatedAt
);

public record CreateRemittanceRequest(
    Guid CourierId,
    List<Guid> OrderIds,
    decimal Amount,
    string Method,
    string? Reference,
    DateTime RemittedAt,
    string? Note
);
