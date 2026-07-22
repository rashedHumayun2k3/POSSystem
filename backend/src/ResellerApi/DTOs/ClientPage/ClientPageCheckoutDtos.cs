namespace ResellerApi.DTOs.ClientPage;

public record ClientPageCheckoutItem(Guid VariantId, decimal Qty);

public record ClientPageCheckoutRequest(
    string CustomerName,
    string CustomerPhone,
    string BuildingStreet,
    string? ColonyLandmark,
    string City,
    string? Label,
    List<ClientPageCheckoutItem> Items,
    string? ClientUid
);

public record ClientPageShopOrderResultDto(
    Guid ShopId,
    string ShopName,
    bool Success,
    Guid? OrderId,
    string? OrderNo,
    string? ErrorMessage,
    decimal DeliveryCharge
);

public record ClientPageCheckoutResultDto(
    Guid CheckoutGroupId,
    List<ClientPageShopOrderResultDto> Shops
);

public record ClientPageShippingAddressDto(
    string FullName,
    string Phone,
    string BuildingStreet,
    string? ColonyLandmark,
    string City,
    string? Label
);

public record ClientPageDeliveryEstimateRequest(List<Guid> BusinessIds, string City);

public record ClientPageDeliveryEstimateItemDto(Guid BusinessId, decimal DeliveryCharge);
