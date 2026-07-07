namespace ResellerApi.DTOs.ClientPage;

public record ClientPageCheckoutItem(Guid VariantId, decimal Qty);

public record ClientPageCheckoutRequest(
    string CustomerName,
    string CustomerPhone,
    string CustomerAddress,
    List<ClientPageCheckoutItem> Items,
    string? ClientUid
);

public record ClientPageShopOrderResultDto(
    Guid ShopId,
    string ShopName,
    bool Success,
    Guid? OrderId,
    string? OrderNo,
    string? ErrorMessage
);

public record ClientPageCheckoutResultDto(
    Guid CheckoutGroupId,
    List<ClientPageShopOrderResultDto> Shops
);
