using ResellerApi.DTOs.Catalog;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class BarcodeLabelPdfGeneratorTests
{
    private static readonly VariantLabelData Sample = new(
        "A product name long enough to exercise the two-line label clamp",
        "Large / Blue",
        "880000016",
        "P-0001-03",
        1250m);

    [Theory]
    [InlineData(4, 1)]
    [InlineData(4, 3)]
    [InlineData(30, 1)]
    public void A4Batch_GeneratesPrintReadyPdf(int quantity, int startPosition)
    {
        var request = new BarcodeLabelBatchRequest(
            "A4",
            [new BarcodeLabelBatchItemRequest(Guid.NewGuid(), quantity)],
            new A4BarcodeTemplateRequest(48, 38, 4, 7, 2, 2, 8, 6, 8, 6),
            null,
            startPosition);

        var pdf = BarcodeLabelPdfGenerator.GenerateBatch([new BarcodeLabelPrintItem(Sample, quantity)], request);

        AssertPdf(pdf);
    }

    [Fact]
    public void RollBatch_GeneratesOneLabelPerPdfPage()
    {
        var request = new BarcodeLabelBatchRequest(
            "ROLL",
            [new BarcodeLabelBatchItemRequest(Guid.NewGuid(), 5)],
            null,
            new RollBarcodeSizeRequest(45, 25));

        var pdf = BarcodeLabelPdfGenerator.GenerateBatch([new BarcodeLabelPrintItem(Sample, 5)], request);

        AssertPdf(pdf);
    }

    private static void AssertPdf(byte[] pdf)
    {
        Assert.True(pdf.Length > 1_000);
        Assert.Equal("%PDF-", System.Text.Encoding.ASCII.GetString(pdf, 0, 5));
    }
}
