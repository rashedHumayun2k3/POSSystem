using System.Net;
using ResellerApi.DTOs.Reports;

namespace ResellerApi.Services;

public static class DailyClosingEmailTemplateRenderer
{
    public static string Render(DailyClosingReportDto report, string? lang)
    {
        var labels = Labels.For(lang);
        var template = LoadTemplate(labels.Code);

        return template
            .Replace("{{businessName}}", E(report.BusinessName))
            .Replace("{{branchName}}", E(report.BranchName))
            .Replace("{{reportDate}}", E($"{report.Date:dd MMM yyyy}, {report.DayName}"))
            .Replace("{{generatedAt}}", E($"{DateTime.UtcNow.AddHours(6):dd MMM yyyy hh:mm tt} BST"))
            .Replace("{{summaryTable}}", SummaryTable(report, labels))
            .Replace("{{ownerDashboard}}", OwnerDashboard(report, labels))
            .Replace("{{actionItems}}", ActionItems(report, labels))
            .Replace("{{topProductsSection}}", TopProducts(report, labels))
            .Replace("{{lowStockSection}}", LowStock(report, labels));
    }

    private static string LoadTemplate(string lang)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Templates", "Emails", $"daily-closing.{lang}.html");
        if (!File.Exists(path))
            path = Path.Combine(AppContext.BaseDirectory, "Templates", "Emails", "daily-closing.en.html");
        return File.ReadAllText(path);
    }

    private static string SummaryTable(DailyClosingReportDto r, Labels l)
    {
        var rows = new[]
        {
            Row(l.TotalSales, Money(r.TotalSales)),
            Row(l.NetSales, Money(r.NetSales)),
            Row(l.TotalDiscountGiven, Money(r.TotalDiscount)),
            Row(l.TotalProfit, Money(r.TotalProfit)),
            Row(l.TotalExpenses, Money(r.TotalExpenses)),
            Row(l.NetProfit, Money(r.NetProfit)),
            Row(l.AverageOrderValue, Money(r.AverageOrderValue)),
            Row(l.Due, Money(r.TotalDue)),
            Row(l.Paid, Money(r.TotalPaid)),
            Row(l.DueCollection, Money(r.DueCollection)),
            Row(l.TotalOutstandingDue, Money(r.TotalOutstandingDue)),
            Row(l.Orders, r.OrdersReceived.ToString()),
            Row(l.Delivered, r.OrdersDelivered.ToString()),
            Row(l.Pending, r.OrdersPending.ToString()),
            Row(l.Returned, r.OrdersReturned.ToString()),
            Row(l.Purchase, Money(r.PurchaseTotal)),
            Row(l.LowStockItems, r.LowStockProducts.Count.ToString())
        };
        return $"<table cellpadding=\"8\" cellspacing=\"0\" style=\"border-collapse:collapse;width:100%;max-width:620px\">{string.Concat(rows)}</table>";
    }

    private static string OwnerDashboard(DailyClosingReportDto r, Labels l) =>
        "<ul style=\"margin-top:0\">" + string.Concat(r.OwnerDashboard.Select(i =>
            $"<li><strong>{E(l.Translate(i.Label))}:</strong> {E(l.Translate(i.Status))}</li>")) + "</ul>";

    private static string ActionItems(DailyClosingReportDto r, Labels l) =>
        "<ul style=\"margin-top:0\">" + string.Concat(r.TomorrowActionItems.Select(i =>
            $"<li>{E(l.Translate(i))}</li>")) + "</ul>";

    private static string TopProducts(DailyClosingReportDto r, Labels l)
    {
        if (r.SoldProducts.Count == 0) return "";
        var rows = r.SoldProducts.Take(5).Select(p =>
            Cells(ProductLabel(p.ProductName, p.VariantLabel), Qty(p.Qty), Money(p.Revenue)));
        return $"<h3 style=\"margin:22px 0 8px\">{E(l.TopProductsSold)}</h3><table cellpadding=\"8\" cellspacing=\"0\" style=\"border-collapse:collapse;width:100%;max-width:620px\">{Header(l.Product, l.Qty, l.Revenue)}{string.Concat(rows)}</table>";
    }

    private static string LowStock(DailyClosingReportDto r, Labels l)
    {
        if (r.LowStockProducts.Count == 0) return "";
        var rows = r.LowStockProducts.Take(5).Select(p => Cells(ProductLabel(p.ProductName, p.VariantLabel), p.Sku, Qty(p.Quantity)));
        return $"<h3 style=\"margin:22px 0 8px\">{E(l.LowStockAlert)}</h3><table cellpadding=\"8\" cellspacing=\"0\" style=\"border-collapse:collapse;width:100%;max-width:620px\">{Header(l.Product, "SKU", l.Stock)}{string.Concat(rows)}</table>";
    }

    private static string Row(string label, string value) =>
        $"<tr><td style=\"border:1px solid #e5e7eb;color:#6b7280\">{E(label)}</td><td style=\"border:1px solid #e5e7eb;font-weight:700;text-align:right\">{E(value)}</td></tr>";

    private static string Header(params string[] values) =>
        "<tr>" + string.Join("", values.Select(v => $"<th style=\"border:1px solid #e5e7eb;background:#f9fafb;text-align:left\">{E(v)}</th>")) + "</tr>";

    private static string Cells(params string[] values) =>
        "<tr>" + string.Join("", values.Select(v => $"<td style=\"border:1px solid #e5e7eb\">{E(v)}</td>")) + "</tr>";

    private static string ProductLabel(string name, string? variant) =>
        string.IsNullOrWhiteSpace(variant) ? name : $"{name} ({variant})";

    private static string Money(decimal value) => $"৳{value:N2}";
    private static string Qty(decimal value) => value % 1 == 0 ? value.ToString("N0") : value.ToString("N2");
    private static string E(string value) => WebUtility.HtmlEncode(value);

    private sealed record Labels(
        string Code, string TotalSales, string NetSales, string TotalDiscountGiven,
        string TotalProfit, string TotalExpenses, string NetProfit, string AverageOrderValue,
        string Due, string Paid, string DueCollection, string TotalOutstandingDue, string Orders,
        string Delivered, string Pending, string Returned, string Purchase, string LowStockItems,
        string TopProductsSold, string Product, string Qty, string Revenue, string LowStockAlert, string Stock)
    {
        public string Translate(string value)
        {
            var map = Code == "bn" ? BnMap : [];
            return map.TryGetValue(value, out var translated) ? translated : value;
        }

        private static readonly Dictionary<string, string> BnMap = new()
        {
            ["Restock low inventory items"] = "কম স্টক প্রোডাক্টে স্টক যোগ করুন",
            ["Follow up pending orders"] = "পেন্ডিং অর্ডার ফলোআপ করুন",
            ["Collect outstanding payments"] = "বাকি টাকা কালেক্ট করুন",
            ["Contact today's new customers for feedback"] = "আজকের নতুন কাস্টমারের সাথে ফিডব্যাকের জন্য যোগাযোগ করুন",
            ["No urgent action needed for tomorrow"] = "আগামীকালের জন্য জরুরি কোনো কাজ নেই",
            ["Sales"] = "বিক্রি",
            ["Profit"] = "লাভ",
            ["Stock"] = "স্টক",
            ["Pending Delivery"] = "পেন্ডিং ডেলিভারি",
            ["Good"] = "ভালো",
            ["No sales today"] = "আজ বিক্রি হয়নি",
            ["Hidden"] = "লুকানো",
            ["Positive"] = "পজিটিভ",
            ["Loss"] = "লোকসান",
            ["Healthy"] = "ভালো আছে",
            ["Clear"] = "ক্লিয়ার"
        };

        public static Labels For(string? lang) => string.Equals(lang, "bn", StringComparison.OrdinalIgnoreCase)
            ? new Labels("bn", "মোট বিক্রি", "নেট বিক্রি", "মোট ডিসকাউন্ট", "মোট লাভ", "মোট খরচ",
                "নেট লাভ", "গড় অর্ডার ভ্যালু", "বাকি", "পেইড", "বাকি আদায়", "মোট বাকি আছে",
                "অর্ডার", "ডেলিভার্ড", "পেন্ডিং", "রিটার্ন", "ক্রয়", "কম স্টক আইটেম",
                "সবচেয়ে বেশি বিক্রি হওয়া প্রোডাক্ট", "প্রোডাক্ট", "পরিমাণ", "বিক্রি", "কম স্টক অ্যালার্ট", "স্টক")
            : new Labels("en", "Total Sales", "Net Sales", "Total Discount Given", "Total Profit", "Total Expenses",
                "Net Profit", "Average Order Value", "Baki / Due", "Paid", "Due Collection", "Total Outstanding Due",
                "Orders", "Delivered", "Pending", "Returned", "Purchase", "Low Stock Items",
                "Top Products Sold", "Product", "Qty", "Revenue", "Low Stock Alert", "Stock");
    }
}
