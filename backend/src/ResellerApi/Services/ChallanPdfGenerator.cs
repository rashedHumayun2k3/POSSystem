using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ResellerApi.Entities;

namespace ResellerApi.Services;

public static class ChallanPdfGenerator
{
    static ChallanPdfGenerator()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public static byte[] Generate(Order order, string businessName)
    {
        var subtotal = order.Items.Where(i => i.DeletedAt == null).Sum(i => i.Qty * i.UnitPrice);
        decimal discount = 0;
        if (order.DiscountType == "PERCENT" && order.DiscountValue.HasValue)
            discount = Math.Round(subtotal * order.DiscountValue.Value / 100, 2);
        else if (order.DiscountType == "FIXED" && order.DiscountValue.HasValue)
            discount = order.DiscountValue.Value;
        var codAmount = subtotal - discount + order.DeliveryChargeCustomer;

        return Document.Create(container =>
        {
            // Two copies per R8.4
            for (int copy = 1; copy <= 2; copy++)
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A5);
                    page.Margin(20);
                    page.DefaultTextStyle(x => x.FontSize(10));

                    page.Content().Column(col =>
                    {
                        // Header
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text(businessName).FontSize(14).Bold();
                                c.Item().Text($"Challan: {order.OrderNo}").FontSize(12).Bold();
                                c.Item().Text($"Copy {copy} of 2").FontSize(8).FontColor(Colors.Grey.Medium);
                            });
                            row.ConstantItem(80).Column(c =>
                            {
                                c.Item().AlignRight().Text($"Date: {order.CreatedAt:dd/MM/yyyy}").FontSize(9);
                                c.Item().AlignRight().Text($"Channel: {order.Channel}").FontSize(9);
                            });
                        });

                        col.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                        // Customer info
                        col.Item().Text("Customer:").Bold();
                        col.Item().Text(order.CustomerName);
                        col.Item().Text($"Phone: {order.CustomerPhone}");
                        if (!string.IsNullOrWhiteSpace(order.CustomerAddress))
                            col.Item().Text($"Address: {order.CustomerAddress}");

                        if (!string.IsNullOrWhiteSpace(order.TrackingNo))
                            col.Item().Text($"Tracking: {order.TrackingNo}");

                        col.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                        // Items table
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(cols =>
                            {
                                cols.RelativeColumn(4);
                                cols.RelativeColumn(1);
                                cols.RelativeColumn(2);
                                cols.RelativeColumn(2);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Text("Item").Bold();
                                header.Cell().AlignRight().Text("Qty").Bold();
                                header.Cell().AlignRight().Text("Price").Bold();
                                header.Cell().AlignRight().Text("Total").Bold();
                            });

                            foreach (var item in order.Items.Where(i => i.DeletedAt == null))
                            {
                                var name = item.Variant?.Product?.Name ?? "—";
                                var variantLabel = item.Variant?.VariantValuesJson;
                                table.Cell().Text(string.IsNullOrWhiteSpace(variantLabel) ? name : $"{name}\n{variantLabel}").FontSize(9);
                                table.Cell().AlignRight().Text(item.Qty.ToString("G"));
                                table.Cell().AlignRight().Text($"৳{item.UnitPrice:N2}");
                                table.Cell().AlignRight().Text($"৳{item.Qty * item.UnitPrice:N2}");
                            }
                        });

                        col.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Grey.Medium);

                        // Totals
                        col.Item().AlignRight().Text($"Subtotal: ৳{subtotal:N2}");
                        if (discount > 0)
                            col.Item().AlignRight().Text($"Discount: -৳{discount:N2}");
                        if (order.DeliveryChargeCustomer > 0)
                            col.Item().AlignRight().Text($"Delivery charge: ৳{order.DeliveryChargeCustomer:N2}");

                        col.Item().PaddingVertical(2);
                        col.Item().AlignRight().Text($"COD Amount: ৳{codAmount:N2}").FontSize(12).Bold();

                        col.Item().PaddingVertical(8);

                        // Barcode (Code 39 text representation — embed order no prominently)
                        col.Item().AlignCenter().Border(1).BorderColor(Colors.Black).Padding(6)
                            .Text(order.OrderNo).FontSize(16).Bold().LetterSpacing(2);
                        col.Item().AlignCenter().Text("Scan to confirm delivery").FontSize(8).FontColor(Colors.Grey.Medium);
                    });
                });
            }
        }).GeneratePdf();
    }
}
