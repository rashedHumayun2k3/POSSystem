using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ResellerApi.Entities;

namespace ResellerApi.Services;

// A4 order invoice for online-channel orders (WEBSITE/FACEBOOK/WHATSAPP/etc) — a customer-facing
// order record, distinct from ReceiptPdfGenerator (80mm POS payment receipt for Shop/Hawker
// counter sales) and ChallanPdfGenerator (courier delivery/consignment note, not customer-facing).
// Never include cost/profit here — this document can end up in a customer's hands.
public static class OrderInvoicePdfGenerator
{
    static OrderInvoicePdfGenerator()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public static byte[] Generate(Order order, string businessName, string? branchAddress, string? branchPhone, byte[]? logoBytes)
    {
        var subtotal = order.Items.Where(i => i.DeletedAt == null).Sum(i => i.Qty * i.UnitPrice);
        decimal discount = 0;
        if (order.DiscountType == "PERCENT" && order.DiscountValue.HasValue)
            discount = Math.Round(subtotal * order.DiscountValue.Value / 100, 2);
        else if (order.DiscountType == "FIXED" && order.DiscountValue.HasValue)
            discount = order.DiscountValue.Value;
        var total = subtotal - discount + order.DeliveryChargeCustomer;
        var payments = order.Payments.Where(p => p.DeletedAt == null).OrderBy(p => p.ReceivedAt).ToList();
        var totalPaid = payments.Sum(p => p.Amount);
        var due = total - totalPaid;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Content().Column(col =>
                {
                    // ── Header — business identity (left) / order info (right) ──
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Row(inner =>
                        {
                            if (logoBytes is { Length: > 0 })
                            {
                                inner.ConstantItem(56).Height(56).Image(logoBytes).FitArea();
                                inner.ConstantItem(10);
                            }
                            inner.RelativeItem().Column(c =>
                            {
                                c.Item().Text(businessName).FontSize(18).Bold().FontColor(Colors.BlueGrey.Darken3);
                                if (!string.IsNullOrWhiteSpace(branchAddress))
                                    c.Item().Text(branchAddress).FontSize(9).FontColor(Colors.Grey.Darken1);
                                if (!string.IsNullOrWhiteSpace(branchPhone))
                                    c.Item().Text($"Phone: {branchPhone}").FontSize(9).FontColor(Colors.Grey.Darken1);
                            });
                        });
                        row.ConstantItem(180).Column(c =>
                        {
                            c.Item().AlignRight().Text("ORDER INVOICE").FontSize(14).Bold().FontColor(Colors.BlueGrey.Darken3);
                            c.Item().AlignRight().Text($"Order No: {order.OrderNo}").FontSize(10).Bold();
                            c.Item().AlignRight().Text($"Date: {order.CreatedAt:dd/MM/yyyy hh:mm tt}").FontSize(9);
                            c.Item().AlignRight().Text($"Status: {Humanize(order.PaymentStatus)}").FontSize(9)
                                .FontColor(order.PaymentStatus == "PAID" ? Colors.Green.Darken1 : Colors.Orange.Darken2);
                        });
                    });

                    col.Item().PaddingVertical(10).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                    // ── Customer ──
                    col.Item().Text("CUSTOMER").FontSize(9).Bold().FontColor(Colors.BlueGrey.Darken2).LetterSpacing(1);
                    col.Item().PaddingTop(2).Text(order.CustomerName).FontSize(11).Bold();
                    col.Item().Text(order.CustomerPhone).FontSize(9).FontColor(Colors.Grey.Darken1);
                    if (!string.IsNullOrWhiteSpace(order.CustomerAddress))
                        col.Item().Text(order.CustomerAddress).FontSize(9).FontColor(Colors.Grey.Darken1);

                    col.Item().PaddingVertical(10);

                    // ── Item table ──
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(5);
                            cols.RelativeColumn(1);
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(2);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.BlueGrey.Darken3).Padding(6).Text("SKU").FontColor(Colors.White).Bold().FontSize(9);
                            header.Cell().Background(Colors.BlueGrey.Darken3).Padding(6).Text("DESCRIPTION").FontColor(Colors.White).Bold().FontSize(9);
                            header.Cell().Background(Colors.BlueGrey.Darken3).Padding(6).AlignRight().Text("QTY").FontColor(Colors.White).Bold().FontSize(9);
                            header.Cell().Background(Colors.BlueGrey.Darken3).Padding(6).AlignRight().Text("UNIT PRICE").FontColor(Colors.White).Bold().FontSize(9);
                            header.Cell().Background(Colors.BlueGrey.Darken3).Padding(6).AlignRight().Text("TOTAL").FontColor(Colors.White).Bold().FontSize(9);
                        });

                        var rowIndex = 0;
                        foreach (var item in order.Items.Where(i => i.DeletedAt == null))
                        {
                            var bg = rowIndex++ % 2 == 0 ? Colors.White : Colors.Grey.Lighten4;
                            var name = item.Variant?.Product?.Name ?? "—";
                            var variantLabel = FormatVariantLabel(item.Variant?.VariantValuesJson);
                            var description = string.IsNullOrWhiteSpace(variantLabel) ? name : $"{name} ({variantLabel})";

                            table.Cell().Background(bg).Padding(6).Text(item.Variant?.Sku ?? "—").FontSize(9);
                            table.Cell().Background(bg).Padding(6).Text(description).FontSize(9);
                            table.Cell().Background(bg).Padding(6).AlignRight().Text(item.Qty.ToString("G")).FontSize(9);
                            table.Cell().Background(bg).Padding(6).AlignRight().Text($"৳{item.UnitPrice:N2}").FontSize(9);
                            table.Cell().Background(bg).Padding(6).AlignRight().Text($"৳{item.Qty * item.UnitPrice:N2}").FontSize(9);
                        }
                    });

                    col.Item().PaddingVertical(10);

                    // ── Totals block (right-aligned) ──
                    col.Item().AlignRight().Width(220).Column(c =>
                    {
                        c.Item().Row(row =>
                        {
                            row.RelativeItem().Text("Subtotal").FontSize(9).FontColor(Colors.Grey.Darken1);
                            row.RelativeItem().AlignRight().Text($"৳{subtotal:N2}").FontSize(9);
                        });
                        if (discount > 0)
                            c.Item().Row(row =>
                            {
                                row.RelativeItem().Text("Discount").FontSize(9).FontColor(Colors.Grey.Darken1);
                                row.RelativeItem().AlignRight().Text($"-৳{discount:N2}").FontSize(9);
                            });
                        if (order.DeliveryChargeCustomer > 0)
                            c.Item().Row(row =>
                            {
                                row.RelativeItem().Text("Delivery").FontSize(9).FontColor(Colors.Grey.Darken1);
                                row.RelativeItem().AlignRight().Text($"৳{order.DeliveryChargeCustomer:N2}").FontSize(9);
                            });

                        c.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                        c.Item().Background(Colors.BlueGrey.Lighten5).Padding(6).Row(row =>
                        {
                            row.RelativeItem().Text("TOTAL").FontSize(12).Bold();
                            row.RelativeItem().AlignRight().Text($"৳{total:N2}").FontSize(12).Bold();
                        });

                        if (payments.Count > 0)
                        {
                            c.Item().PaddingTop(6);
                            foreach (var payment in payments)
                            {
                                var isNegative = payment.Amount < 0;
                                c.Item().Row(row =>
                                {
                                    row.RelativeItem().Text(Humanize(payment.Method)).FontSize(9).FontColor(Colors.Grey.Darken1);
                                    row.RelativeItem().AlignRight().Text($"৳{payment.Amount:N2}").FontSize(9)
                                        .FontColor(isNegative ? Colors.Orange.Darken2 : Colors.Green.Darken1);
                                });
                            }
                        }

                        if (due > 0)
                            c.Item().PaddingTop(4).Background(Colors.Red.Lighten5).Padding(6).Row(row =>
                            {
                                row.RelativeItem().Text("DUE").FontSize(11).Bold().FontColor(Colors.Red.Darken2);
                                row.RelativeItem().AlignRight().Text($"৳{due:N2}").FontSize(11).Bold().FontColor(Colors.Red.Darken2);
                            });
                    });

                    // ── Note ──
                    if (!string.IsNullOrWhiteSpace(order.Note))
                    {
                        col.Item().PaddingTop(14).Text("NOTE").FontSize(9).Bold().FontColor(Colors.BlueGrey.Darken2).LetterSpacing(1);
                        col.Item().PaddingTop(2).Text(order.Note).FontSize(9).FontColor(Colors.Grey.Darken2);
                    }

                    // ── Footer ──
                    col.Item().PaddingTop(24).AlignCenter().Text("Thank you for shopping with us!").FontSize(10).Bold();
                    col.Item().AlignCenter().Text("Please keep this invoice for any return/exchange.").FontSize(8).FontColor(Colors.Grey.Darken1);
                });
            });
        }).GeneratePdf();
    }

    // VariantValuesJson looks like {"Size":"S","Color":"Red"} — render as "S / Red", not raw JSON.
    private static string FormatVariantLabel(string? variantValuesJson)
    {
        if (string.IsNullOrWhiteSpace(variantValuesJson) || variantValuesJson == "{}")
            return "";
        try
        {
            var values = JsonSerializer.Deserialize<Dictionary<string, string>>(variantValuesJson);
            return values is null ? "" : string.Join(" / ", values.Values.Where(v => !string.IsNullOrWhiteSpace(v)));
        }
        catch (JsonException)
        {
            return "";
        }
    }

    private static string Humanize(string method) => method switch
    {
        "CASH" => "Cash",
        "BKASH" => "bKash",
        "NAGAD" => "Nagad",
        "CARD" => "Card",
        "BAKI" => "Baki (Credit)",
        "STORE_CREDIT" => "Store Credit",
        "COD" => "Cash on Delivery",
        "PAID" => "Paid",
        "PARTIALLY_PAID" => "Partially Paid",
        "UNPAID" => "Unpaid",
        "REFUNDED" => "Refunded",
        _ when method.StartsWith("REFUND_") => $"Refund ({Humanize(method["REFUND_".Length..])})",
        _ => method
    };
}
