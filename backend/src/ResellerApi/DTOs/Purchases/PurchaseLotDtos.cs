namespace ResellerApi.DTOs.Purchases;

public record ShipmentItemInput(Guid PurchaseItemId, decimal Qty);
public record SavePurchaseLotRequest(string LotNo, decimal DeclaredWeightGrams,
    List<ShipmentItemInput> Items, string? TrackingNumber = null, string? Note = null, Guid? CourierId = null,
    Guid? ShippingCompanyId = null, string? ShippingMethod = null);
public record SendPurchaseLotRequest(DateTime? ShippedDate = null);
public record PurchaseLotItemDto(Guid PurchaseItemId, decimal Qty);
public record PurchaseLotDto(Guid Id, string LotNo, string Status, DateTime? ShippedDate,
    decimal DeclaredWeightGrams, decimal MeasuredWeightGrams, decimal BilledWeightGrams,
    string? TrackingNumber, string? Note, List<PurchaseLotItemDto> Items, List<string> WeightWarnings,
    Guid? CourierId = null, string? CourierName = null, Guid? ShippingCompanyId = null,
    string? ShippingCompanyName = null, string? ShippingMethod = null, decimal? RatePerKg = null,
    decimal? CalculatedShippingCost = null);
public record LotImportUpload(string FileName, string Base64);
public record LotImportRow(int Row, string Product, string Variant, decimal Qty,
    Guid? PurchaseItemId, string? Error);
public record LotImportPreview(List<LotImportRow> Rows, bool Valid);
