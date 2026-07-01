using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SkiaSharp;
using ZXing;
using ZXing.Common;
using ZXing.SkiaSharp;

namespace ResellerApi.Services;

public record VariantLabelData(
    string ProductName,
    string VariantLabel,
    string Barcode,
    string Sku,
    decimal Price
);

public static class BarcodeLabelPdfGenerator
{
    static BarcodeLabelPdfGenerator()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private static byte[] RenderBarcode(string text)
    {
        var writer = new BarcodeWriter
        {
            Format = BarcodeFormat.CODE_128,
            Options = new EncodingOptions
            {
                Width = 300,
                Height = 80,
                Margin = 3,
                PureBarcode = false,
            }
        };
        using var bitmap = writer.Write(text);
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Png, 100);
        return encoded.ToArray();
    }

    public static byte[] Generate(List<VariantLabelData> labels, int qtyEach)
    {
        var expanded = labels
            .SelectMany(l => Enumerable.Repeat(l, Math.Max(1, qtyEach)))
            .ToList();

        const int colCount = 4;
        const int rowCount = 7;
        const int perPage = colCount * rowCount;
        int pages = (int)Math.Ceiling(expanded.Count / (double)perPage);

        return Document.Create(container =>
        {
            for (int p = 0; p < pages; p++)
            {
                var slice = expanded.Skip(p * perPage).Take(perPage).ToList();

                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(8, Unit.Millimetre);
                    page.DefaultTextStyle(x => x.FontSize(7));

                    page.Content().Table(table =>
                    {
                        table.ColumnsDefinition(def =>
                        {
                            for (int c = 0; c < colCount; c++)
                                def.RelativeColumn();
                        });

                        foreach (var lbl in slice)
                        {
                            table.Cell()
                                .Border(0.5f)
                                .BorderColor(Colors.Grey.Lighten2)
                                .Padding(3)
                                .Column(col =>
                                {
                                    col.Item()
                                        .Text(lbl.ProductName)
                                        .FontSize(6.5f)
                                        .Bold()
                                        .ClampLines(1, "…");

                                    if (!string.IsNullOrWhiteSpace(lbl.VariantLabel))
                                        col.Item()
                                            .Text(lbl.VariantLabel)
                                            .FontSize(6)
                                            .FontColor(Colors.Grey.Darken2);

                                    col.Item()
                                        .PaddingVertical(2)
                                        .Image(RenderBarcode(lbl.Barcode))
                                        .FitWidth();

                                    col.Item().Row(row =>
                                    {
                                        row.RelativeItem()
                                            .Text(lbl.Sku)
                                            .FontSize(5.5f)
                                            .FontColor(Colors.Grey.Darken1);
                                        row.AutoItem()
                                            .Text($"৳{lbl.Price:N0}")
                                            .FontSize(7.5f)
                                            .Bold();
                                    });
                                });
                        }

                        // Pad remaining cells to preserve grid alignment
                        int remainder = slice.Count % colCount;
                        if (remainder > 0)
                        {
                            for (int i = remainder; i < colCount; i++)
                                table.Cell()
                                    .Border(0.5f)
                                    .BorderColor(Colors.Grey.Lighten3)
                                    .MinHeight(38, Unit.Millimetre)
                                    .Element(_ => { });
                        }
                    });
                });
            }
        }).GeneratePdf();
    }
}
