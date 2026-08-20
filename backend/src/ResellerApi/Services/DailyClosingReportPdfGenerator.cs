using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ResellerApi.DTOs.Reports;

namespace ResellerApi.Services;

public static class DailyClosingReportPdfGenerator
{
    static DailyClosingReportPdfGenerator()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public static byte[] Generate(DailyClosingReportDto report, string? lang = null)
    {
        var labels = Labels.For(lang);
        var generatedAt = DateTime.UtcNow.AddHours(6);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header().AlignCenter().Column(col =>
                {
                    col.Item().Text(report.BusinessName).FontSize(18).Bold();
                    col.Item().Text($"{labels.Branch}: {report.BranchName}")
                        .FontSize(10).FontColor(Colors.Grey.Darken2);
                    col.Item().Text($"{labels.Title} - {report.Date:dd MMM yyyy}, {report.DayName}")
                        .FontSize(11).FontColor(Colors.Grey.Darken2);
                    col.Item().Text($"{labels.Generated}: {generatedAt:dd MMM yyyy hh:mm tt} BST")
                        .FontSize(8).FontColor(Colors.Grey.Darken1);
                });

                page.Content().PaddingTop(16).Column(col =>
                {
                    col.Spacing(12);

                    col.Item().Grid(grid =>
                    {
                        grid.Columns(3);
                        Metric(grid, labels.TotalSales, Money(report.TotalSales));
                        Metric(grid, labels.NetSales, Money(report.NetSales));
                        Metric(grid, labels.TotalProfit, Money(report.TotalProfit));
                        Metric(grid, labels.NetProfit, Money(report.NetProfit));
                        Metric(grid, labels.Due, Money(report.TotalDue));
                        Metric(grid, labels.Paid, Money(report.TotalPaid));
                        Metric(grid, labels.Orders, report.OrdersReceived.ToString());
                        Metric(grid, labels.Pending, report.OrdersPending.ToString());
                        Metric(grid, labels.Purchase, Money(report.PurchaseTotal));
                    });

                    Section(col, labels.SalesPerformance);
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn();
                            c.RelativeColumn();
                            c.RelativeColumn();
                            c.RelativeColumn();
                        });
                        Header(table, labels.Metric, labels.Value, labels.Metric, labels.Value);
                        Row(table, labels.TotalOrdersReceived, report.OrdersReceived, labels.OrdersDelivered, report.OrdersDelivered);
                        Row(table, labels.OrdersPending, report.OrdersPending, labels.OrdersReturned, report.OrdersReturned);
                        Row(table, labels.TotalDiscountGiven, Money(report.TotalDiscount), labels.AverageOrderValue, Money(report.AverageOrderValue));
                        Row(table, labels.TopSellingProduct, report.TopSellingProduct ?? labels.None, labels.Cancelled, report.OrdersCancelled);
                    });

                    AddOrderList(col, labels.NewOrdersTakenToday, report.NewOrders, labels);
                    AddOrderList(col, labels.DeliveredOrders, report.DeliveredOrders, labels);
                    AddOrderList(col, labels.ReturnedOrders, report.ReturnedOrders, labels);
                    AddOrderList(col, labels.PendingOrders, report.PendingOrders, labels);

                    if (report.PaymentMethods.Count > 0)
                    {
                        Section(col, labels.PaymentSummary);
                        SimpleNameValueTable(col, report.PaymentMethods, money: true, labels);
                    }
                    Section(col, labels.DueSummary);
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn();
                            c.RelativeColumn();
                            c.RelativeColumn();
                            c.RelativeColumn();
                        });
                        Header(table, labels.DueCollection, labels.NewDueCreated, labels.PaidToday, labels.TotalOutstandingDue);
                        Row(table, Money(report.DueCollection), Money(report.NewDueCreated), Money(report.TotalPaid), Money(report.TotalOutstandingDue));
                    });

                    if (report.SoldProducts.Count > 0)
                    {
                        Section(col, labels.ProductSalesReport);
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(3);
                                c.RelativeColumn(2);
                                c.RelativeColumn();
                                c.RelativeColumn();
                                c.RelativeColumn();
                            });
                            Header(table, labels.Product, "SKU", labels.Qty, labels.Sales, labels.Profit);
                            foreach (var p in report.SoldProducts)
                                Row(table, ProductLabel(p.ProductName, p.VariantLabel), p.Sku, Qty(p.Qty), Money(p.Revenue), Money(p.Profit));
                        });
                    }

                    if (report.LowStockProducts.Count > 0)
                    {
                        Section(col, labels.LowStockList);
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(3);
                                c.RelativeColumn(2);
                                c.RelativeColumn();
                                c.RelativeColumn();
                            });
                            Header(table, labels.Product, "SKU", labels.Qty, labels.MinimumStock);
                            foreach (var p in report.LowStockProducts)
                                Row(table, ProductLabel(p.ProductName, p.VariantLabel), p.Sku, Qty(p.Quantity), Qty(p.ReorderLevel));
                        });
                    }

                    if (report.PurchaseItems.Count > 0)
                    {
                        Section(col, labels.PurchaseInventoryUpdate);
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(3);
                                c.RelativeColumn(2);
                                c.RelativeColumn();
                                c.RelativeColumn();
                            });
                            Header(table, labels.Product, "SKU", labels.Qty, labels.Cost);
                            foreach (var p in report.PurchaseItems)
                                Row(table, ProductLabel(p.ProductName, p.VariantLabel), p.Sku, Qty(p.Qty), Money(p.TotalCost));
                        });
                    }

                    Section(col, labels.CustomerInsights);
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn();
                            c.RelativeColumn();
                            c.RelativeColumn();
                            c.RelativeColumn();
                        });
                        Header(table, labels.NewCustomers, labels.ReturningCustomers, labels.HighestSpendingCustomer, labels.Complaints);
                        Row(table,
                            report.CustomerInsights.NewCustomersToday,
                            report.CustomerInsights.ReturningCustomers,
                            report.CustomerInsights.HighestSpendingCustomerName == null
                                ? labels.None
                                : $"{report.CustomerInsights.HighestSpendingCustomerName} - {Money(report.CustomerInsights.HighestSpendingCustomerAmount)}",
                            report.CustomerInsights.CustomerComplaints);
                    });

                    if (report.Expenses.Count > 0)
                    {
                        Section(col, labels.ExpenseTracking);
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(2);
                                c.RelativeColumn();
                            });
                            Header(table, labels.ExpenseType, labels.Amount);
                            foreach (var e in report.Expenses)
                                Row(table, e.Type, Money(e.Amount));
                            Row(table, labels.TotalExpenses, Money(report.TotalExpenses));
                        });
                    }

                    Section(col, labels.Profitability);
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn();
                            c.RelativeColumn();
                            c.RelativeColumn();
                        });
                        Header(table, labels.GrossProfit, labels.Expenses, labels.NetProfit);
                        Row(table, Money(report.TotalProfit), Money(report.TotalExpenses), Money(report.NetProfit));
                    });

                    Section(col, labels.TomorrowsActionItems);
                    foreach (var item in report.TomorrowActionItems)
                        col.Item().Text($"- {labels.Translate(item)}");

                    Section(col, labels.OwnerDashboard);
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn();
                            c.RelativeColumn();
                        });
                        Header(table, labels.Area, labels.Status);
                        foreach (var item in report.OwnerDashboard)
                            Row(table, labels.Translate(item.Label), labels.Translate(item.Status));
                    });
                });

                page.Footer().AlignRight()
                    .Text($"{labels.Generated}: {generatedAt:dd MMM yyyy hh:mm tt} BST")
                    .FontSize(8)
                    .FontColor(Colors.Grey.Darken1);
            });
        }).GeneratePdf();
    }

    private static void Metric(GridDescriptor grid, string label, string value)
    {
        grid.Item().Padding(3).Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Column(col =>
        {
            col.Item().Text(label).FontSize(8).FontColor(Colors.Grey.Darken1);
            col.Item().Text(value).FontSize(13).Bold();
        });
    }

    private static void Section(ColumnDescriptor col, string title) =>
        col.Item().PaddingTop(4).Text(title).FontSize(12).Bold();

    private static void Header(TableDescriptor table, params string[] values)
    {
        foreach (var value in values)
            table.Cell().Background(Colors.Grey.Lighten3).Padding(5).Text(value).Bold();
    }

    private static void Row(TableDescriptor table, params object[] values)
    {
        foreach (var value in values)
            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(5).Text(value?.ToString() ?? "");
    }

    private static void SimpleNameValueTable(ColumnDescriptor col, List<NameValue> rows, bool money, Labels labels)
    {
        col.Item().Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.RelativeColumn();
                c.RelativeColumn();
            });
            Header(table, labels.Name, labels.Value);
            foreach (var row in rows)
                Row(table, row.Name, money ? Money(row.Value) : Qty(row.Value));
        });
    }

    private static void AddOrderList(ColumnDescriptor col, string title, List<DailyClosingOrderItemDto> orders, Labels labels)
    {
        Section(col, title);
        if (orders.Count == 0)
        {
            col.Item().Text(labels.None).FontColor(Colors.Grey.Darken1);
            return;
        }

        col.Item().Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.RelativeColumn(2);
                c.RelativeColumn(3);
                c.RelativeColumn();
                c.RelativeColumn(2);
            });
            Header(table, labels.Order, labels.Customer, labels.Amount, labels.Note);
            foreach (var order in orders)
                Row(table, order.OrderNo, order.CustomerName, Money(order.Amount), order.Note ?? order.Status);
        });
    }

    private static string ProductLabel(string name, string? variant) =>
        string.IsNullOrWhiteSpace(variant) ? name : $"{name} ({variant})";

    private static string Money(decimal value) => $"BDT {value:N2}";
    private static string Qty(decimal value) => value % 1 == 0 ? value.ToString("N0") : value.ToString("N2");

    private sealed record Labels(
        string Title, string Branch, string Generated, string TotalSales, string NetSales,
        string TotalProfit, string NetProfit, string Due, string Paid, string Orders,
        string Pending, string Purchase, string SalesPerformance, string Metric, string Value,
        string TotalOrdersReceived, string OrdersDelivered, string OrdersPending, string OrdersReturned,
        string TotalDiscountGiven, string AverageOrderValue, string TopSellingProduct, string Cancelled,
        string None, string NewOrdersTakenToday, string DeliveredOrders, string ReturnedOrders,
        string PendingOrders, string PaymentSummary, string DueSummary, string DueCollection,
        string NewDueCreated, string PaidToday, string TotalOutstandingDue, string ProductSalesReport,
        string Product, string Qty, string Sales, string Profit, string LowStockList, string MinimumStock,
        string PurchaseInventoryUpdate, string Cost, string CustomerInsights, string NewCustomers,
        string ReturningCustomers, string HighestSpendingCustomer, string Complaints, string ExpenseTracking,
        string ExpenseType, string Amount, string TotalExpenses, string Profitability, string GrossProfit,
        string Expenses, string TomorrowsActionItems, string OwnerDashboard, string Area, string Status,
        string Name, string Order, string Customer, string Note)
    {
        public string Translate(string value)
        {
            var map = ForBnMap();
            return map.TryGetValue(value, out var translated) ? translated : value;
        }

        private Dictionary<string, string> ForBnMap() => Title == "আজকের ক্লোজিং রিপোর্ট"
            ? new Dictionary<string, string>
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
            }
            : new Dictionary<string, string>();

        public static Labels For(string? lang) => string.Equals(lang, "bn", StringComparison.OrdinalIgnoreCase)
            ? new Labels(
                "আজকের ক্লোজিং রিপোর্ট", "শাখা", "রিপোর্ট তৈরির সময়", "মোট বিক্রি", "নেট বিক্রি",
                "মোট লাভ", "নেট লাভ", "বাকি", "পেইড", "অর্ডার",
                "পেন্ডিং", "ক্রয়", "বিক্রির পারফরম্যান্স", "বিষয়", "মান",
                "আজকের মোট অর্ডার", "ডেলিভার্ড অর্ডার", "পেন্ডিং অর্ডার", "রিটার্ন অর্ডার",
                "মোট ডিসকাউন্ট", "গড় অর্ডার ভ্যালু", "সবচেয়ে বেশি বিক্রি", "বাতিল",
                "নেই", "আজ নেওয়া অর্ডার", "ডেলিভার্ড অর্ডার", "রিটার্ন অর্ডার",
                "পেন্ডিং অর্ডার", "পেমেন্ট সারাংশ", "বাকি সারাংশ", "বাকি আদায়",
                "নতুন বাকি", "আজ পেইড", "মোট বাকি আছে", "প্রোডাক্ট বিক্রি রিপোর্ট",
                "প্রোডাক্ট", "পরিমাণ", "বিক্রি", "লাভ", "কম স্টক প্রোডাক্ট", "মিনিমাম স্টক",
                "ক্রয় ও স্টক আপডেট", "খরচ", "কাস্টমার তথ্য", "নতুন কাস্টমার",
                "পুরনো কাস্টমার", "সবচেয়ে বেশি কেনা কাস্টমার", "অভিযোগ", "খরচের হিসাব",
                "খরচের ধরন", "টাকা", "মোট খরচ", "লাভের হিসাব", "গ্রস লাভ",
                "খরচ", "আগামীকালের কাজ", "ওনার ড্যাশবোর্ড", "এরিয়া", "স্ট্যাটাস",
                "নাম", "অর্ডার", "কাস্টমার", "নোট")
            : new Labels(
                "Daily Closing Summary", "Branch", "Report Generated", "Total Sales", "Net Sales",
                "Total Profit", "Net Profit", "Baki / Due", "Paid", "Orders",
                "Pending", "Purchase", "Sales Performance", "Metric", "Value",
                "Total Orders Received", "Orders Delivered", "Orders Pending", "Orders Returned",
                "Total Discount Given", "Average Order Value", "Top Selling Product", "Cancelled",
                "None", "New Orders Taken Today", "Delivered Orders", "Returned Orders",
                "Pending Orders", "Payment Summary", "Due Summary", "Due Collection",
                "New Due Created", "Paid Today", "Total Outstanding Due", "Product Sales Report",
                "Product", "Qty", "Sales", "Profit", "Current Low Quantity Product List", "Reorder",
                "Purchase / Inventory Update", "Cost", "Customer Insights", "New Customers",
                "Returning Customers", "Highest Spending Customer", "Complaints", "Expense Tracking",
                "Expense Type", "Amount", "Total Expenses", "Profitability", "Gross Profit",
                "Expenses", "Tomorrow's Action Items", "Owner Dashboard", "Area", "Status",
                "Name", "Order", "Customer", "Note");
    }
}
