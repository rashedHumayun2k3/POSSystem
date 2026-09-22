namespace ResellerApi.DTOs.Orders;

public record InvoiceListDto(Guid Id, string OrderNo, string Channel, string CustomerName,
    DateOnly BusinessDate, decimal TotalAmount, decimal TotalPaid, decimal DueAmount);

public record InvoiceSummaryDto(DateOnly Date, decimal Total, decimal Paid, decimal Due);
public record InvoiceListPageDto(List<InvoiceListDto> Items, int TotalCount, int Page, int PageSize, InvoiceSummaryDto Summary);

public record InvoicePreviewDto(string OrderNo, string CustomerName, List<string> Pages, MobileInvoiceDto Invoice);

public record MobileInvoiceItemDto(string ItemId, string Description, string Variant, string Sku,
    string Qty, string UnitPrice, string Discount, string TotalPrice);
public record MobileInvoiceDto(string DocumentNumber, string InvoiceDate, string OrderDate,
    string SellerName, string? SellerAddress, string? SellerPhone, string? SellerEmail,
    string? SellerWebsite, string? Logo, string? ContactLink, string? CustomerAddress,
    string? CustomerPhone, string Currency, string PaymentMethods, List<MobileInvoiceItemDto> Items,
    string Subtotal, string Discount, string Shipping, string Total, string Paid, string Due, string? Credit);
