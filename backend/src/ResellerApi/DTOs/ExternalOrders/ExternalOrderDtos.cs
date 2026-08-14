namespace ResellerApi.DTOs.ExternalOrders;

public record ExternalOrderItemRequest(
    Guid? VariantId,
    string? Sku,
    string? Barcode,
    decimal Qty,
    decimal? UnitPrice
);

public record ExternalOrderCreateRequest(
    string CustomerName,
    string CustomerPhone,
    string? CustomerAddress,
    List<ExternalOrderItemRequest> Items,
    decimal? DeliveryChargeCustomer,
    decimal? AdvancePaid,
    string? AdvancePaymentMethod,
    string? Note,
    string? ExternalOrderId,
    string? SourceWebsiteUrl,
    Guid? CourierId,
    Guid? BranchId,
    DateOnly? BusinessDate
);

public record ExternalOrderCreateResponse(
    bool Success,
    Guid OrderId,
    string OrderNo,
    string Status,
    string Source,
    string? ExternalOrderId
);

public record ExternalOrderIntegrationDto(
    Guid Id,
    string Name,
    string? SourceWebsiteUrl,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateExternalOrderIntegrationRequest(
    string Name,
    string? SourceWebsiteUrl
);

public record CreateExternalOrderIntegrationResponse(
    Guid Id,
    string Name,
    string ApiKey,
    string? SourceWebsiteUrl,
    bool IsActive
);
