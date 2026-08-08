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

public record HomeSummaryDto(
    int TodayOrders,
    int PendingDeliveries,
    int StockAlerts,
    decimal CustomerReceivable, // customer baki — excludes COD cash currently held at courier
    decimal MoneyAtCourier,     // COD collected by courier, pending remittance to us
    decimal TodayCash           // cash payments received today — not net of cash spent from the drawer
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
