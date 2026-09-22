using System.Globalization;
using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ResellerApi.Entities;
using ResellerApi.DTOs.Orders;

namespace ResellerApi.Services;

public record InvoiceSeller(string Name, string? Address, string? Phone, byte[]? Logo,
    string Currency = "BDT", string? ContactUrl = null, string? TaxRegistration = null,
    string? PosRegistration = null, string? FiscalInvoiceNumber = null, string? Email = null);

// Customer copy only: never render internal notes, cost snapshots, margins or profit.
public static class OrderInvoicePdfGenerator
{
    private const string Border = "#555555";
    private const string Purple = "#4B3F72";
    public static MobileInvoiceDto CreateMobileInvoice(Order order, InvoiceSeller seller)
    {
        string Money(decimal value) => value.ToString("N2", CultureInfo.InvariantCulture);
        var items = order.Items.Where(i => i.DeletedAt == null).ToList();
        var payments = order.Payments.Where(p => p.DeletedAt == null).ToList();
        var subtotal = items.Sum(i => i.Qty * i.UnitPrice);
        var discount = order.DiscountType == "PERCENT" ? Math.Round(subtotal * (order.DiscountValue ?? 0) / 100, 2)
            : order.DiscountType == "FIXED" ? order.DiscountValue ?? 0 : 0;
        var total = subtotal - discount + order.DeliveryChargeCustomer;
        var paid = payments.Sum(p => p.Amount);
        decimal allocated = 0;
        var lines = items.Select((item, index) =>
        {
            var amount = item.Qty * item.UnitPrice;
            var lineDiscount = index == items.Count - 1 ? discount - allocated
                : subtotal == 0 ? 0 : Math.Round(discount * amount / subtotal, 2);
            allocated += lineDiscount;
            return new MobileInvoiceItemDto(item.Variant?.Product?.Sku ?? item.VariantId.ToString("N"),
                item.Variant?.Product?.Name ?? "—", FormatVariantLabel(item.Variant?.VariantValuesJson),
                item.Variant?.Sku ?? "—", item.Qty.ToString("0.###", CultureInfo.InvariantCulture),
                Money(item.UnitPrice), Money(lineDiscount), Money(amount - lineDiscount));
        }).ToList();
        var methods = string.Join(" / ", payments.Where(p => p.Amount > 0).Select(p => Humanize(p.Method)).Distinct());
        return new MobileInvoiceDto($"INV-{order.OrderNo}",
            (order.ConfirmedAt ?? order.CreatedAt).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
            order.BusinessDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
            seller.Name, seller.Address, seller.Phone, seller.Email, seller.ContactUrl,
            seller.Logo is { Length: > 0 } ? "data:image/png;base64," + Convert.ToBase64String(seller.Logo) : null,
            ContactLink(seller), order.CustomerAddress, order.CustomerPhone,
            string.IsNullOrWhiteSpace(seller.Currency) ? "BDT" : seller.Currency, methods.Length == 0 ? "Unpaid" : methods,
            lines, Money(subtotal), Money(discount), Money(order.DeliveryChargeCustomer), Money(total), Money(paid),
            Money(Math.Max(0, total - paid)), paid > total ? Money(paid - total) : null);
    }
    static OrderInvoicePdfGenerator() => QuestPDF.Settings.License = LicenseType.Community;

    public static byte[] Generate(Order order, string businessName, string? branchAddress,
        string? branchPhone, byte[]? logoBytes, string currency = "BDT", string? contactUrl = null)
        => CreateDocument(order, new InvoiceSeller(businessName, branchAddress, branchPhone, logoBytes,
            currency, contactUrl)).GeneratePdf();

    public static Document CreateMobileDocument(Order order, InvoiceSeller seller)
    {
        var invoice = CreateMobileInvoice(order, seller);
        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A5);
            page.Margin(8, QuestPDF.Infrastructure.Unit.Millimetre);
            page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(10));
            page.Content().Column(col =>
            {
                col.Spacing(6);
                void Field(string label, string? value)
                {
                    if (!string.IsNullOrWhiteSpace(value)) col.Item().Text($"{label}: {value}");
                }
                col.Item().Text("INVOICE").FontSize(18).Bold().FontColor(Purple);
                Field("Doc No", invoice.DocumentNumber);
                Field("Invoice Date", invoice.InvoiceDate);
                if (seller.Logo is { Length: > 0 }) col.Item().Height(35).Image(seller.Logo).FitArea();
                col.Item().Text(invoice.SellerName).Bold().FontColor(Purple);
                Field("Address", invoice.SellerAddress);
                Field("Contact", invoice.SellerPhone);
                Field("Email", invoice.SellerEmail);
                Field("Website", invoice.SellerWebsite);
                col.Item().PaddingTop(6).Text("Bill To").Bold();
                col.Item().Text(order.CustomerName);
                Field("Address", invoice.CustomerAddress);
                Field("Contact", invoice.CustomerPhone);
                Field("Order Number", order.OrderNo);
                Field("Mode Of Payment", invoice.PaymentMethods);
                Field("Order Date", invoice.OrderDate);
                col.Item().PaddingTop(6).Text($"Your Ordered Item(s) · {invoice.Items.Count}").Bold();
                foreach (var item in invoice.Items)
                {
                    col.Item().BorderTop(0.5f).BorderColor("#DDDDDD").PaddingTop(6).Text(item.Description).Bold();
                    Field("Variant", item.Variant);
                    Field("Item ID", item.ItemId);
                    Field("Item SKU", item.Sku);
                    Field("Qty", item.Qty);
                    Field("MRP", "—");
                    Field("Unit Price", $"{invoice.Currency} {item.UnitPrice}");
                    Field("Tax Amount", "—");
                    Field("Discount", $"{invoice.Currency} {item.Discount}");
                    Field("Total Price", $"{invoice.Currency} {item.TotalPrice}");
                }
                col.Item().Text($"Amounts in {invoice.Currency}. — = not recorded. Discount is allocated across items.").FontSize(8);
                col.Item().PaddingTop(6).Text("Invoice totals").Bold().FontColor(Purple);
                Field("Total Unit Price", $"{invoice.Currency} {invoice.Subtotal}");
                Field("Discount", $"-{invoice.Currency} {invoice.Discount}");
                Field("Total Shipping", $"{invoice.Currency} {invoice.Shipping}");
                Field("Total", $"{invoice.Currency} {invoice.Total}");
                Field("Paid", $"{invoice.Currency} {invoice.Paid}");
                col.Item().Text($"Total Payable Amount: {invoice.Currency} {invoice.Due}").Bold().FontColor(Purple);
                if (invoice.Credit != null) Field("Credit / Overpayment", $"{invoice.Currency} {invoice.Credit}");
                col.Item().PaddingTop(6).Text("Need Help? Please contact the seller for help with your order.").FontSize(9);
                if (invoice.ContactLink != null) col.Item().Hyperlink(invoice.ContactLink).Text("Contact Us").FontColor(Purple);
            });
            page.Footer().AlignCenter().Text(text => { text.Span("Customer copy · "); text.CurrentPageNumber(); });
        }));
    }

    public static Document CreateDocument(Order order, InvoiceSeller seller)
    {
        var items = order.Items.Where(i => i.DeletedAt == null).ToList();
        var payments = order.Payments.Where(p => p.DeletedAt == null).ToList();
        var subtotal = items.Sum(i => i.Qty * i.UnitPrice);
        var discount = order.DiscountType == "PERCENT" ? Math.Round(subtotal * (order.DiscountValue ?? 0) / 100, 2)
            : order.DiscountType == "FIXED" ? order.DiscountValue ?? 0 : 0;
        var total = subtotal - discount + order.DeliveryChargeCustomer;
        var paid = payments.Sum(p => p.Amount);
        // Stable on every reprint, scoped by the order's existing unique number.
        var documentNumber = $"INV-{order.OrderNo}";
        var currency = string.IsNullOrWhiteSpace(seller.Currency) ? "BDT" : seller.Currency;
        string Money(decimal value) => value.ToString("N2", CultureInfo.InvariantCulture);
        var paymentMethods = string.Join(" / ", payments.Where(p => p.Amount > 0).Select(p => Humanize(p.Method)).Distinct());
        if (paymentMethods.Length == 0) paymentMethods = "Unpaid";

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.PageColor(Colors.White);
            page.Margin(10, QuestPDF.Infrastructure.Unit.Millimetre);
            page.DefaultTextStyle(s => s.FontFamily("Arial").FontSize(8).FontColor(Colors.Black));
            page.Content().Column(col =>
            {
                col.Item().Row(row =>
                {
                    row.RelativeItem().Text(t => { t.Span("Invoice Date: ").Underline().FontColor(Purple); t.Span($"{order.ConfirmedAt ?? order.CreatedAt:dd/MM/yyyy}"); });
                    row.RelativeItem().AlignRight().Text(t => { t.Span("Doc No: ").Underline().FontColor(Purple); t.Span(documentNumber); });
                });
                col.Item().Background("#D9D9D9").PaddingVertical(4).AlignCenter().Text("INVOICE").FontSize(17).Bold();
                col.Item().PaddingTop(10).Row(row =>
                {
                    row.RelativeItem(4).Padding(4).Column(c =>
                    {
                        c.Item().Row(header =>
                        {
                            if (seller.Logo is { Length: > 0 })
                                header.ConstantItem(48).Height(40).AlignMiddle().Image(seller.Logo).FitArea();
                            header.RelativeItem().AlignMiddle().Text(seller.Name).FontSize(13).Bold().FontColor(Purple);
                        });
                        if (!string.IsNullOrWhiteSpace(seller.Address)) c.Item().PaddingTop(5).Text($"Address: {seller.Address}");
                        if (!string.IsNullOrWhiteSpace(seller.Phone)) c.Item().Text($"Contact: {seller.Phone}");
                        if (!string.IsNullOrWhiteSpace(seller.Email)) c.Item().Text($"Email: {seller.Email}");
                        if (!string.IsNullOrWhiteSpace(seller.ContactUrl)) c.Item().Text($"Website: {seller.ContactUrl}");
                    });
                    row.ConstantItem(12);
                    row.RelativeItem(4).Padding(4).Column(c =>
                    {
                        c.Item().Text("Bill To:").Bold();
                        c.Item().PaddingTop(12).Text(order.CustomerName).Bold();
                        if (!string.IsNullOrWhiteSpace(order.CustomerAddress)) c.Item().Text(order.CustomerAddress);
                        if (!string.IsNullOrWhiteSpace(order.CustomerPhone)) c.Item().PaddingTop(5).Text($"Contact: {order.CustomerPhone}");
                    });
                });
                col.Item().PaddingTop(20).Table(table =>
                {
                    table.ColumnsDefinition(c => { c.RelativeColumn(1.4f); c.RelativeColumn(); c.RelativeColumn(); });
                    table.Cell().Element(Cell).Text($"Order Number: {order.OrderNo}");
                    table.Cell().Element(Cell).Text($"Mode Of Payment: {paymentMethods}");
                    table.Cell().Element(Cell).Text($"Order Date: {order.BusinessDate:dd/MM/yyyy}");
                });
                col.Item().PaddingTop(20).Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        foreach (var width in new[] { 0.45f, 1.15f, 2.2f, 1.3f, 0.5f, 0.8f, 1.1f, 0.8f, 1.05f, 1.2f }) c.RelativeColumn(width);
                    });
                    table.Header(header =>
                    {
                        header.Cell().ColumnSpan(10).Element(Cell).Text("Your Ordered Item(s)").Bold();
                        foreach (var title in new[] { "S/N", "Item ID", "Description", "Item SKU", "Qty", "MRP", "Unit Price", "Tax Amount", "Discount", "Total Price" })
                            header.Cell().Element(Cell).Text(title).Bold();
                    });
                    decimal allocated = 0;
                    for (var index = 0; index < items.Count; index++)
                    {
                        var item = items[index];
                        var lineAmount = item.Qty * item.UnitPrice;
                        // Allocate the order discount for display; put rounding remainder on the final row.
                        var lineDiscount = index == items.Count - 1 ? discount - allocated
                            : subtotal == 0 ? 0 : Math.Round(discount * lineAmount / subtotal, 2);
                        allocated += lineDiscount;
                        var variant = FormatVariantLabel(item.Variant?.VariantValuesJson);
                        var description = item.Variant?.Product?.Name ?? "—";
                        if (variant.Length > 0) description += $"\n{variant}";
                        table.Cell().Element(Cell).Text((index + 1).ToString());
                        table.Cell().Element(Cell).Text(item.Variant?.Product?.Sku ?? item.VariantId.ToString("N"));
                        table.Cell().Element(Cell).AlignLeft().Text(description);
                        table.Cell().Element(Cell).AlignLeft().Text(item.Variant?.Sku ?? "—");
                        table.Cell().Element(Cell).Text(item.Qty.ToString("0.###", CultureInfo.InvariantCulture));
                        // Neither historical MRP nor tax is captured on the order. Do not invent them from today's catalog.
                        table.Cell().Element(Cell).Text("—");
                        table.Cell().Element(Cell).AlignRight().Text(Money(item.UnitPrice));
                        table.Cell().Element(Cell).Text("—");
                        table.Cell().Element(Cell).AlignRight().Text(Money(lineDiscount));
                        table.Cell().Element(Cell).AlignRight().Text(Money(lineAmount - lineDiscount));
                    }
                    table.Cell().ColumnSpan(6).Element(Cell).Text("TOTAL").Bold();
                    table.Cell().Element(Cell).AlignRight().Text(Money(subtotal)).Bold();
                    table.Cell().Element(Cell).Text("—");
                    table.Cell().Element(Cell).AlignRight().Text(Money(discount)).Bold();
                    table.Cell().Element(Cell).AlignRight().Text(Money(subtotal - discount)).Bold();
                });
                col.Item().PaddingTop(4).Text($"Amounts in {currency}. — = not recorded. Discount is allocated across items.").FontSize(7).FontColor(Border);
                col.Item().PaddingTop(14).ShowEntire().Row(row =>
                {
                    row.RelativeItem();
                    row.ConstantItem(24);
                    row.RelativeItem().Column(c =>
                    {
                        Summary(c, "Total Unit Price", subtotal, currency);
                        Summary(c, "Discount", -discount, currency);
                        Summary(c, "Total Shipping", order.DeliveryChargeCustomer, currency);
                        Summary(c, "Total", total, currency);
                        Summary(c, "Paid", paid, currency);
                        c.Item().PaddingTop(3).BorderTop(0.7f).BorderColor(Border).PaddingTop(5).Row(r =>
                        {
                            r.RelativeItem().Text("Total Payable Amount").Bold().Underline().FontColor(Purple);
                            r.ConstantItem(28).Text(currency).FontSize(7);
                            r.ConstantItem(65).AlignRight().Text(Money(Math.Max(0, total - paid))).Bold();
                        });
                        if (paid > total) Summary(c, "Credit / Overpayment", paid - total, currency);
                    });
                });
            });
            page.Footer().PaddingTop(16).Column(c =>
            {
                c.Item().AlignCenter().Text("Need Help?").Bold();
                c.Item().AlignCenter().Text("Happy to assist you. Please contact the seller for help with your order.").FontSize(8);
                c.Item().PaddingTop(3).AlignCenter().Width(145).Element(contact =>
                {
                    var url = ContactLink(seller);
                    if (url != null) contact = contact.Hyperlink(url);
                    contact.Background("#FF6B21").PaddingVertical(4).AlignCenter()
                        .Text(string.IsNullOrWhiteSpace(seller.Phone) ? "Contact Us" : $"Contact Us: {seller.Phone}")
                        .FontColor(Colors.White).FontSize(8).Bold();
                });
                c.Item().PaddingTop(5).AlignCenter().DefaultTextStyle(s => s.FontSize(7).FontColor(Border)).Text(t => { t.Span("Customer copy · "); t.CurrentPageNumber(); t.Span(" / "); t.TotalPages(); });
            });
        }));
    }

    private static IContainer Cell(IContainer c) => c.ShowEntire().Border(0.4f).BorderColor(Border).Padding(3).AlignMiddle().AlignCenter().DefaultTextStyle(s => s.FontSize(7));
    private static void Summary(ColumnDescriptor c, string label, decimal amount, string currency)
        => c.Item().PaddingBottom(6).Row(r =>
        {
            r.RelativeItem().Text(label).Bold();
            r.ConstantItem(28).Text(currency).FontSize(7);
            r.ConstantItem(65).AlignRight().Text(amount.ToString("N2", CultureInfo.InvariantCulture));
        });

    private static string? ContactLink(InvoiceSeller seller)
    {
        if (Uri.TryCreate(seller.ContactUrl, UriKind.Absolute, out var url) && (url.Scheme == "https" || url.Scheme == "http")) return url.AbsoluteUri;
        if (string.IsNullOrWhiteSpace(seller.Phone)) return null;
        var phone = new string(seller.Phone.Where(c => char.IsDigit(c) || c == '+').ToArray());
        return phone.Length > 0 ? $"tel:{phone}" : null;
    }

    private static string FormatVariantLabel(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return "";
        try { return string.Join(" / ", JsonSerializer.Deserialize<Dictionary<string, string>>(json)?.Values.Where(v => !string.IsNullOrWhiteSpace(v)) ?? []); }
        catch (JsonException) { return ""; }
    }

    private static string Humanize(string method) => method switch
    {
        "CASH" => "Cash", "BKASH" => "bKash", "NAGAD" => "Nagad", "CARD" => "Card",
        "BAKI" => "Baki (Credit)", "STORE_CREDIT" => "Store Credit", "COD" => "Cash on Delivery", _ => method.Replace('_', ' ')
    };
}
