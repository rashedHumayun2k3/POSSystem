namespace ResellerApi.DTOs.Purchases;

public record ShippingCompanyRateDto(Guid Id, string ShippingMethod, string ChargeBasis,
    decimal RateAmount, string CurrencyCode, decimal? MinimumCharge);

public record ShippingCompanyDto(Guid Id, string Name, string? Phone, string? LocalAddress, string? ChinaAddress,
    string? Notes, bool IsActive, List<ShippingCompanyRateDto> Rates);

public record SaveShippingCompanyRequest(string Name, decimal? AirRatePerKg,
    decimal? SeaRatePerKg, string? Phone = null, string? LocalAddress = null,
    string? ChinaAddress = null, string? Notes = null);

public record SavePurchaseShipmentRequest(Guid ShippingCompanyId, string ShippingMethod,
    decimal BillableQuantity, string? TrackingNumber = null, string? Note = null);

public record PurchaseShipmentDto(Guid Id, Guid ShippingCompanyId, string ShippingCompanyName,
    string ShippingMethod, string ChargeBasis, decimal RateAmount, string CurrencyCode,
    decimal BillableQuantity, decimal CalculatedCost, string? TrackingNumber, string? Note);
