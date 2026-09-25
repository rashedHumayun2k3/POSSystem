namespace ResellerApi.DTOs.PreOrders;

public sealed record CreatePreOrderItemRequest(Guid ProductId, Guid VariantId, decimal Quantity);
public sealed record CreatePreOrderRequest(
    IReadOnlyList<CreatePreOrderItemRequest> Items,
    bool ReserveAvailableStock,
    string? CustomerName,
    string? CustomerPhone,
    string? CustomerEmail,
    string? CustomerReference,
    string? CustomerNote,
    string? StaffNote,
    DateTime? ExpectedDate,
    DateTime? PickupDeadline);
public sealed record CancelPreOrderRequest(string Reason);
