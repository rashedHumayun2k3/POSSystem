namespace ResellerApi.DTOs.Reports;

// ── Stock Valuation ───────────────────────────────────────────────────────────
//
// Time semantics (do not conflate these two groups):
//   - Stock-side fields (AvgBuyPrice, OnHandQty, StockValue, PotentialProfit, TotalBoughtQty) are
//     always "as of now" — the date range never applies to them.
//   - Sales-side fields (QtySold, Revenue, RealizedProfit, AvgActualSellPrice, SoldPerMonth,
//     MonthsOfStockLeft) are filtered by the selected date range.
// RealizedProfit uses OrderItem.UnitCostSnapshot (frozen at order time), never the current
// AvgLandedCost, so a later cost change never retroactively rewrites a past period's profit.
//
// This whole report is cost/profit data end to end, so — like /reports/financial — the
// *endpoint* is restricted to Owner/Manager (see ReportsController) rather than masking
// individual fields per role; there's no meaningful "staff view" of a stock valuation report.

public record StockValuationProductDto(
    Guid ProductId,
    string ProductName,
    Guid CategoryId,
    string CategoryName,
    decimal AvgBuyPrice,          // weighted by on-hand qty across variants
    decimal OnHandQty,
    decimal StockValue,           // Σ(AvgLandedCost × OnHand) across variants
    decimal PotentialProfit,      // (SellingPrice − AvgBuyPrice) × OnHandQty
    decimal QtySold,
    decimal Revenue,
    decimal RealizedProfit,
    decimal AvgActualSellPrice,   // Revenue ÷ QtySold
    decimal? SoldPerMonth,        // null when the range is too short to be meaningful (< ~28 days)
    decimal? MonthsOfStockLeft,   // null under the same condition, or when velocity is 0
    decimal TotalBoughtQty        // all-time PURCHASE_IN qty, not date-ranged
);

public record StockValuationCategoryDto(
    Guid CategoryId,
    string CategoryName,
    decimal StockValue,
    decimal RealizedProfit,
    List<StockValuationProductDto> Products
);

public record StockValuationResponseDto(
    decimal GrandStockValue,
    decimal GrandPotentialProfit,
    decimal GrandRealizedProfit,  // computed at order level so it ties to the Dashboard/P&L for
                                  // the same period when no category filter is applied;
                                  // category-filtered views fall back to summing the filtered
                                  // product rows (same caveat as existing by-category breakdowns
                                  // elsewhere: discount/delivery aren't apportioned per line)
    decimal GrandRevenue,
    DateTime RangeFromDate,   // inclusive, shop-local calendar date
    DateTime RangeToDate,     // inclusive, shop-local calendar date
    string RangeLabel,        // e.g. "এই মাস"
    bool ShowVelocity,
    List<StockValuationCategoryDto> Categories
);
