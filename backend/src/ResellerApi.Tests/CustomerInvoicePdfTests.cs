using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using ResellerApi.Entities;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

public class CustomerInvoicePdfTests
{
    [Theory]
    [InlineData(1)]
    [InlineData(50)]
    public void MobilePdf_RendersA5Pages_WithLongText(int count)
    {
        var document = OrderInvoicePdfGenerator.CreateMobileDocument(SampleOrder(count),
            new InvoiceSeller("Store", "Address", "01700000000", null));
        var pdf = document.GeneratePdf();
        Assert.Equal("%PDF-", System.Text.Encoding.ASCII.GetString(pdf, 0, 5));
        var pages = document.GenerateImages(new ImageGenerationSettings { RasterDpi = 72 }).ToList();
        Assert.NotEmpty(pages);
        if (count == 50) Assert.True(pages.Count > 1);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(50)]
    public void CustomerCopy_RendersPrintablePages_WithLongText(int count)
    {
        var order = SampleOrder(count);
        var document = OrderInvoicePdfGenerator.CreateDocument(order,
            new InvoiceSeller("LavLokshan Store", "18 Main Road, Floor 3\nDhaka, Bangladesh", "01700000000", null,
                ContactUrl: "https://lavlokshan.example", Email: "support@lavlokshan.example"));
        var pdf = document.GeneratePdf();
        Assert.Equal("%PDF-", System.Text.Encoding.ASCII.GetString(pdf, 0, 5));
        var pages = document.GenerateImages(new ImageGenerationSettings { RasterDpi = 96 }).ToList();
        if (count == 1) Assert.Single(pages);
        else Assert.True(pages.Count > 1);
        var output = Environment.GetEnvironmentVariable("INVOICE_PREVIEW_DIR");
        if (!string.IsNullOrEmpty(output))
        {
            Directory.CreateDirectory(output);
            File.WriteAllBytes(Path.Combine(output, $"customer-invoice-{count}.pdf"), pdf);
            for (var i = 0; i < pages.Count; i++) File.WriteAllBytes(Path.Combine(output, $"customer-invoice-{count}-{i + 1}.png"), pages[i]);
        }
    }

    [Fact]
    public void MobileInvoice_PreservesMultipleItemsAndExcludesDeletedRecords()
    {
        var order = SampleOrder(3);
        order.Items.Add(new OrderItem { Qty = 10, UnitPrice = 999, DeletedAt = DateTime.UtcNow });
        order.Payments.Add(new OrderPayment { Amount = 9999, Method = "CASH", DeletedAt = DateTime.UtcNow });
        var invoice = OrderInvoicePdfGenerator.CreateMobileInvoice(order,
            new InvoiceSeller("Store", "Address", "Phone", null));
        Assert.Equal(3, invoice.Items.Count);
        Assert.Equal("1,520.00", invoice.Subtotal);
        Assert.Equal("152.00", invoice.Discount);
        Assert.Equal("1,428.00", invoice.Total);
        Assert.Equal("200.00", invoice.Paid);
        Assert.Equal("1,228.00", invoice.Due);
        Assert.Equal("bKash", invoice.PaymentMethods);
        Assert.Equal("684.00", invoice.Items[0].TotalPrice);
        Assert.Equal("342.00", invoice.Items[1].TotalPrice);
        Assert.Equal("PRD-00042", invoice.Items[0].ItemId);
        Assert.Equal("28 x 24 cm / Multicolour", invoice.Items[0].Variant);
    }

    [Fact]
    public void MobileInvoice_AllocatesRoundingRemainderAndShowsOverpayment()
    {
        var order = SampleOrder(3);
        foreach (var item in order.Items) { item.Qty = 1; item.UnitPrice = 1; }
        order.DiscountType = "FIXED";
        order.DiscountValue = 1;
        order.DeliveryChargeCustomer = 0;
        var invoice = OrderInvoicePdfGenerator.CreateMobileInvoice(order,
            new InvoiceSeller("Store", null, null, null));
        Assert.Equal(new[] { "0.33", "0.33", "0.34" }, invoice.Items.Select(i => i.Discount));
        Assert.Equal("2.00", invoice.Total);
        Assert.Equal("0.00", invoice.Due);
        Assert.Equal("198.00", invoice.Credit);
    }

    private static Order SampleOrder(int count)
    {
        var order = new Order
        {
            OrderNo = "ORD-20260912-0042", CustomerName = "Sample Customer",
            CustomerPhone = "01800000000", CustomerAddress = "House 12, Road 4\nMirpur, Dhaka 1216\nBangladesh",
            CreatedAt = new DateTime(2026, 9, 12), ConfirmedAt = new DateTime(2026, 9, 12),
            BusinessDate = new DateOnly(2026, 9, 11), Channel = "FACEBOOK", DiscountType = "PERCENT",
            DiscountValue = 10, DeliveryChargeCustomer = 60,
            Note = "INTERNAL NOTE MUST NOT APPEAR",
        };
        for (var i = 0; i < count; i++)
            order.Items.Add(new OrderItem
            {
                Qty = i == 0 ? 2 : 1, UnitPrice = 380, UnitCostSnapshot = 123,
                Variant = new ProductVariant
                {
                    Sku = "WALL-STICKER-FLORAL-28X24-MULTICOLOUR", VariantValuesJson = "{\"Size\":\"28 x 24 cm\",\"Color\":\"Multicolour\"}",
                    Product = new Product { Name = "Decorative Wall Sticker — Floral Pattern", Sku = "PRD-00042" }
                }
            });
        order.Payments.Add(new OrderPayment { Amount = 200, Method = "BKASH" });
        return order;
    }
}
