using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ResellerApi.Entities;

namespace ResellerApi.Services;

// POS sale receipt — narrow layout sized for an 80mm thermal receipt printer (R12.1), but
// prints fine on regular paper too since it's just opened as a PDF in the browser.
public static class ReceiptPdfGenerator
{
    static ReceiptPdfGenerator()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private const float ReceiptWidthPt = 226; // ~80mm

    public static byte[] Generate(Order order, string businessName, string? branchAddress, string? branchPhone)
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
        var change = totalPaid - total;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.ContinuousSize(ReceiptWidthPt);
                page.Margin(12);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Content().Column(col =>
                {
                    // Header
                    col.Item().AlignCenter().Text(businessName).FontSize(13).Bold();
                    if (!string.IsNullOrWhiteSpace(branchAddress))
                        col.Item().AlignCenter().Text(branchAddress).FontSize(8).FontColor(Colors.Grey.Darken1);
                    if (!string.IsNullOrWhiteSpace(branchPhone))
                        col.Item().AlignCenter().Text($"Phone: {branchPhone}").FontSize(8).FontColor(Colors.Grey.Darken1);

                    col.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                    col.Item().Text($"Receipt: {order.OrderNo}").Bold();
                    col.Item().Text($"Date: {order.CreatedAt:dd/MM/yyyy hh:mm tt}").FontSize(8);
                    if (!string.IsNullOrWhiteSpace(order.CustomerName) && order.CustomerName != "Walk-in")
                        col.Item().Text($"Customer: {order.CustomerName}").FontSize(8);

                    col.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                    // Items
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cols =>
                        {
                            cols.RelativeColumn(5);
                            cols.RelativeColumn(2);
                            cols.RelativeColumn(3);
                        });

                        foreach (var item in order.Items.Where(i => i.DeletedAt == null))
                        {
                            var name = item.Variant?.Product?.Name ?? "—";
                            var variantLabel = FormatVariantLabel(item.Variant?.VariantValuesJson);
                            var label = string.IsNullOrWhiteSpace(variantLabel) ? name : $"{name} ({variantLabel})";

                            table.Cell().ColumnSpan(3).PaddingTop(3).Text(label).FontSize(9);
                            table.Cell().Text($"{item.Qty:G} x {item.UnitPrice:N2}").FontSize(8).FontColor(Colors.Grey.Darken1);
                            table.Cell().ColumnSpan(2);
                            table.Cell().ColumnSpan(3).AlignRight().Text($"৳{item.Qty * item.UnitPrice:N2}").FontSize(9);
                        }
                    });

                    col.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                    // Totals
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Text("Subtotal");
                        row.RelativeItem().AlignRight().Text($"৳{subtotal:N2}");
                    });
                    if (discount > 0)
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text("Discount");
                            row.RelativeItem().AlignRight().Text($"-৳{discount:N2}");
                        });
                    if (order.DeliveryChargeCustomer > 0)
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text("Delivery");
                            row.RelativeItem().AlignRight().Text($"৳{order.DeliveryChargeCustomer:N2}");
                        });

                    col.Item().PaddingVertical(2).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Text("TOTAL").FontSize(12).Bold();
                        row.RelativeItem().AlignRight().Text($"৳{total:N2}").FontSize(12).Bold();
                    });

                    col.Item().PaddingVertical(4);

                    // Payments
                    foreach (var payment in payments)
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text(Humanize(payment.Method)).FontSize(9);
                            row.RelativeItem().AlignRight().Text($"৳{payment.Amount:N2}").FontSize(9);
                        });
                    }
                    if (change > 0)
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Text("Change");
                            row.RelativeItem().AlignRight().Text($"৳{change:N2}");
                        });

                    col.Item().PaddingVertical(10);
                    col.Item().AlignCenter().Text("Thank you for shopping with us!").FontSize(9).Bold();
                    col.Item().AlignCenter().Text("Please keep this receipt for any return/exchange.").FontSize(7).FontColor(Colors.Grey.Darken1);
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
        _ => method
    };
}
