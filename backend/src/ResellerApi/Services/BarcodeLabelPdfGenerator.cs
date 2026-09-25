using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SkiaSharp;
using ZXing;
using ZXing.Common;
using ZXing.SkiaSharp;
using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services;

public record VariantLabelData(
    string ProductName,
    string VariantLabel,
    string Barcode,
    string Sku,
    decimal Price
);

public record BarcodeLabelPrintItem(VariantLabelData Label, int Quantity);

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

    public static byte[] GenerateBatch(List<BarcodeLabelPrintItem> items, BarcodeLabelBatchRequest request)
    {
        var expanded = items.SelectMany(item => Enumerable.Repeat(item.Label, item.Quantity)).ToList();

        return string.Equals(request.Mode, "ROLL", StringComparison.OrdinalIgnoreCase)
            ? GenerateRoll(expanded, request.Roll!)
            : GenerateA4(expanded, request.A4!, request.StartPosition);
    }

    private static byte[] GenerateA4(List<VariantLabelData> labels, A4BarcodeTemplateRequest template, int startPosition)
    {
        var perPage = template.Columns * template.Rows;
        var cells = Enumerable.Repeat<VariantLabelData?>(null, startPosition - 1)
            .Concat(labels.Cast<VariantLabelData?>())
            .ToList();
        var pageCount = (int)Math.Ceiling(cells.Count / (double)perPage);

        return Document.Create(container =>
        {
            for (var pageIndex = 0; pageIndex < pageCount; pageIndex++)
            {
                var pageCells = cells.Skip(pageIndex * perPage).Take(perPage).ToList();
                while (pageCells.Count < perPage) pageCells.Add(null);

                container.Page(page =>
                {
                    // PageSizes.A4 is stored in rounded PDF points and can be fractionally narrower
                    // than 210 mm. Exact millimetres are required because valid sticker templates
                    // may intentionally consume the full physical width.
                    page.Size(210, 297, Unit.Millimetre);
                    page.MarginTop((float)template.MarginTop, Unit.Millimetre);
                    page.MarginRight((float)template.MarginRight, Unit.Millimetre);
                    page.MarginBottom((float)template.MarginBottom, Unit.Millimetre);
                    page.MarginLeft((float)template.MarginLeft, Unit.Millimetre);
                    page.DefaultTextStyle(x => x.FontFamily(Fonts.Arial).FontSize(7));

                    page.Content().Table(table =>
                    {
                        var tableColumnCount = template.Columns * 2 - 1;
                        table.ColumnsDefinition(columns =>
                        {
                            for (var column = 0; column < template.Columns; column++)
                            {
                                columns.ConstantColumn((float)template.LabelWidth, Unit.Millimetre);
                                if (column < template.Columns - 1)
                                    columns.ConstantColumn((float)template.HorizontalGap, Unit.Millimetre);
                            }
                        });

                        for (var row = 0; row < template.Rows; row++)
                        {
                            for (var column = 0; column < template.Columns; column++)
                            {
                                var label = pageCells[row * template.Columns + column];
                                table.Cell()
                                    .Width((float)template.LabelWidth, Unit.Millimetre)
                                    .Height((float)template.LabelHeight, Unit.Millimetre)
                                    .Element(cell => ComposeLabel(cell, label));

                                if (column < template.Columns - 1)
                                    table.Cell()
                                        .Width((float)template.HorizontalGap, Unit.Millimetre)
                                        .Height((float)template.LabelHeight, Unit.Millimetre);
                            }

                            if (row < template.Rows - 1)
                                table.Cell()
                                    .ColumnSpan((uint)tableColumnCount)
                                    .Height((float)template.VerticalGap, Unit.Millimetre);
                        }
                    });
                });
            }
        }).GeneratePdf();
    }

    private static byte[] GenerateRoll(List<VariantLabelData> labels, RollBarcodeSizeRequest size)
    {
        return Document.Create(container =>
        {
            foreach (var label in labels)
            {
                container.Page(page =>
                {
                    page.Size((float)size.Width, (float)size.Height, Unit.Millimetre);
                    page.Margin(0);
                    page.DefaultTextStyle(x => x.FontFamily(Fonts.Arial).FontSize(7));
                    page.Content().Element(cell => ComposeLabel(cell, label));
                });
            }
        }).GeneratePdf();
    }

    private static void ComposeLabel(IContainer container, VariantLabelData? label)
    {
        if (label is null) return;

        container
            .Padding(4)
            .AlignCenter()
            .AlignMiddle()
            .Column(column =>
            {
                column.Spacing(1);
                column.Item().AlignCenter().Text(label.ProductName).Bold().FontSize(7).ClampLines(2, "…");
                if (!string.IsNullOrWhiteSpace(label.VariantLabel))
                    column.Item().AlignCenter().Text(label.VariantLabel).FontSize(5.5f).FontColor(Colors.Grey.Darken2).ClampLines(1, "…");
                column.Item().MaxHeight(12, Unit.Millimetre).PaddingHorizontal(2).Image(RenderBarcode(label.Barcode)).FitArea();
                column.Item().AlignCenter().Text(label.Barcode).FontFamily(Fonts.CourierNew).FontSize(5.5f);
                column.Item().AlignCenter().Text($"৳{label.Price:N2}").Bold().FontSize(8);
            });
    }
}
