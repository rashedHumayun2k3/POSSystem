namespace ResellerApi.DTOs.Reports;

// ── Common ────────────────────────────────────────────────────────────────────

public record DatePoint(string Label, decimal Value);
public record NameValue(string Name, decimal Value);
// Code drives the frontend's icon lookup (CATEGORY_ICONS); Name/Value keep the same shape
// NameValue already had, so the existing pie chart (dataKey="value" nameKey="name") needs no change.
public record ExpenseCategoryBreakdownDto(string Code, string Name, decimal Value, List<NameValue> Subtypes);

// ── Dashboard ─────────────────────────────────────────────────────────────────

public record DashboardKpiDto(
    decimal TodaySales,
    int TodayOrders,
    decimal TodayProfit,        // owner-only (null for staff)
    int TodayCustomers,
    decimal TodayProductsSold,
    int TodayReturns,
    int LowStockCount,
    int OutOfStockCount,
    List<DatePoint> SalesTrend, // last 30 days
    List<NameValue> TopProducts,
    List<NameValue> PaymentMethods,
    List<DatePoint> HourlySales, // today 0-23h
    List<NameValue> SalesByCategory
);

// ── Home summary (mobile home page tiles) ────────────────────────────────────

public record HomeTopProductDto(
    string Name,
    decimal Quantity,
    decimal Revenue
);

public record HomeSummaryDto(
    decimal TodaySales,
    decimal YesterdaySales,
    decimal? SalesChangePercent,
    decimal? TodayProfit,
    decimal? TodayMarginPercent,
    int TodayOrders,
    int PendingOrders,
    int PendingDeliveries,
    int TodayReturns,
    int LowStockCount,
    int OutOfStockCount,
    decimal CustomerReceivable, // customer baki — excludes COD cash currently held at courier
    int CustomersWithDue,
    decimal MoneyAtCourier,     // COD collected by courier, pending remittance to us
    decimal TodayCash,          // cash payments received today — not net of cash spent from the drawer
    decimal? SupplierPayable,
    int? SuppliersWithDue,
    List<DatePoint> SevenDaySales,
    List<HomeTopProductDto> TopProductsToday
);

// ── Sales ─────────────────────────────────────────────────────────────────────

public record SalesSummaryDto(
    decimal TotalRevenue,
    int TotalOrders,
    decimal TotalDiscount,
    decimal AverageOrderValue,
    List<DatePoint> RevenueByPeriod,
    List<NameValue> TopProducts,
    List<NameValue> ByCategory,
    List<NameValue> ByCashier,
    List<NameValue> ByPaymentMethod,
    List<DatePoint> HourlySales
);

// ── Inventory ─────────────────────────────────────────────────────────────────

public record StockStatusItem(
    string VariantSku,
    string ProductName,
    string? VariantLabel,
    string? Barcode,
    string? ImageUrl,
    decimal OnHand,
    decimal Allocated,
    decimal Available,
    decimal Damaged,
    decimal ReorderLevel,
    bool IsLowStock,
    bool IsOutOfStock
);

public record InventoryReportDto(
    int TotalVariants,
    int LowStockCount,
    int OutOfStockCount,
    decimal TotalInventoryValue, // owner-only
    List<StockStatusItem> Items,
    List<DatePoint> MovementTrend,       // net stock movement per day
    List<NameValue> FastMovingProducts,
    List<NameValue> SlowMovingProducts
);

// ── Financial ─────────────────────────────────────────────────────────────────

public record PnlReportDto(
    decimal Revenue,
    decimal Cogs,
    decimal GrossProfit,
    decimal GrossMarginPct,
    decimal TotalExpenses,
    decimal NetProfit,
    decimal NetMarginPct,
    decimal TotalDiscount,
    List<DatePoint> RevenueTrend,
    List<DatePoint> ProfitTrend,
    List<DatePoint> ExpenseTrend,
    List<ExpenseCategoryBreakdownDto> ExpenseByCategory
);

// ── Orders ────────────────────────────────────────────────────────────────────

public record OrdersReportDto(
    int TotalOrders,
    int CompletedOrders,
    int PendingOrders,
    int CancelledOrders,
    int ReturnedOrders,
    decimal ReturnRate,
    List<DatePoint> OrdersTrend,
    List<DatePoint> CancelledTrend,
    List<NameValue> ReturnReasons,
    List<NameValue> OrdersByChannel
);

// ── Daily Closing Summary ────────────────────────────────────────────────────

public record DailyClosingStatusCountDto(string Status, int Count);

public record DailyClosingSoldProductDto(
    string ProductName,
    string? VariantLabel,
    string Sku,
    decimal Qty,
    decimal Revenue,
    decimal Profit
);

public record DailyClosingLowStockDto(
    string ProductName,
    string? VariantLabel,
    string Sku,
    decimal Quantity,
    decimal ReorderLevel
);

public record DailyClosingPurchaseItemDto(
    string ProductName,
    string? VariantLabel,
    string Sku,
    decimal Qty,
    decimal TotalCost
);

public record DailyClosingOrderItemDto(
    string OrderNo,
    string CustomerName,
    decimal Amount,
    string Status,
    string? Note
);

public record DailyClosingExpenseDto(string Type, decimal Amount);

public record DailyClosingCustomerInsightDto(
    int NewCustomersToday,
    int ReturningCustomers,
    string? HighestSpendingCustomerName,
    decimal HighestSpendingCustomerAmount,
    int CustomerComplaints
);

public record DailyClosingHealthDto(string Label, string Status, string Tone);

public record DailyClosingReportDto(
    DateTime Date,
    string DayName,
    string BusinessName,
    string BranchName,
    bool IsAllBranches,
    decimal TotalSales,
    decimal NetSales,
    decimal TotalProfit,
    decimal NetProfit,
    decimal TotalDue,
    decimal TotalPaid,
    decimal TotalDiscount,
    decimal TotalExpenses,
    decimal AverageOrderValue,
    decimal DueCollection,
    decimal NewDueCreated,
    decimal TotalOutstandingDue,
    int OrdersReceived,
    int OrdersDelivered,
    int OrdersPending,
    int OrdersReturned,
    int OrdersCancelled,
    decimal PurchaseTotal,
    decimal PurchaseQty,
    string? TopSellingProduct,
    List<DailyClosingStatusCountDto> OrderStatuses,
    List<NameValue> PaymentMethods,
    List<DailyClosingSoldProductDto> SoldProducts,
    List<DailyClosingLowStockDto> LowStockProducts,
    List<DailyClosingPurchaseItemDto> PurchaseItems,
    List<DailyClosingOrderItemDto> NewOrders,
    List<DailyClosingOrderItemDto> DeliveredOrders,
    List<DailyClosingOrderItemDto> ReturnedOrders,
    List<DailyClosingOrderItemDto> PendingOrders,
    List<DailyClosingExpenseDto> Expenses,
    DailyClosingCustomerInsightDto CustomerInsights,
    List<string> TomorrowActionItems,
    List<DailyClosingHealthDto> OwnerDashboard
);

public record SendDailyClosingReportRequest(DateTime? Date, string? Lang);
