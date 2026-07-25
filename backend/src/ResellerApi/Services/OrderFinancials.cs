using System.Linq.Expressions;
using ResellerApi.Entities;

namespace ResellerApi.Services;

// The single definition of "a sold order" for reporting purposes, shared by every report that
// needs to reconcile with the Dashboard (Dashboard, Sales Summary, P&L, Stock Valuation). Extracted
// from ReportService, where this exact filter + revenue/COGS formula used to be copy-pasted three
// times. NOTE: this counts a CreatedAt-based order the moment it's created (not cancelled, not a
// draft) as revenue — including orders that are later returned. That's a deliberate match to the
// existing Dashboard/Sales/P&L behavior, not an oversight; it is NOT net of returns. A stricter,
// "actually kept" definition (ConfirmedAt-based, COMPLETED only, excluding RETURNED) already exists
// separately in PopularityService for a different purpose (recent-sales ranking) and intentionally
// is not reused here, since matching the Dashboard was the explicit goal for these reports.
public static class OrderFinancials
{
    public static Expression<Func<Order, bool>> SoldOrderFilter(DateTime from, DateTime toExclusive) =>
        o => o.CreatedAt >= from && o.CreatedAt < toExclusive && o.OrderStatus != "CANCELLED" && !o.IsDraft;

    public static decimal ComputeDiscount(Order o, decimal subtotal)
    {
        if (o.DiscountType == null || o.DiscountValue == null) return 0;
        return o.DiscountType == "PERCENT"
            ? Math.Round(subtotal * o.DiscountValue.Value / 100, 2)
            : o.DiscountValue.Value;
    }

    // Requires o.Items to already be loaded (Include), same precondition as every existing caller.
    public static decimal ComputeOrderRevenue(Order o)
    {
        var sub = o.Items.Sum(i => i.Qty * i.UnitPrice);
        return sub - ComputeDiscount(o, sub) + o.DeliveryChargeCustomer;
    }

    public static decimal ComputeOrderCogs(Order o) =>
        o.Items.Sum(i => i.UnitCostSnapshot.GetValueOrDefault() * i.Qty) + o.DeliveryCostActual;
}
