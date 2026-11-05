using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.OwnerOrManager)]
[Route("api/v1/reports/product-profit")]
public class ProductProfitReportController(AppDbContext db) : ControllerBase
{
    [HttpGet("products")]
    public async Task<IActionResult> Products()
    {
        // Archived products can still have historical sales. Keep the tenant boundary explicit.
        return Ok(await db.Products.IgnoreQueryFilters().AsNoTracking()
            .Where(p => p.BusinessId == db.CurrentBusinessId)
            .OrderBy(p => p.Name).Select(p => new { p.Id, p.Name, p.Sku }).ToListAsync());
    }

    [HttpGet]
    public async Task<IActionResult> Report([FromQuery] DateOnly from, [FromQuery] DateOnly to,
        [FromQuery] Guid[]? productIds)
    {
        if (from == default || to == default || to < from || to.DayNumber - from.DayNumber > 3660)
            return BadRequest(new { message = "Choose a valid date range of up to 10 years." });

        var selected = productIds?.ToHashSet() ?? [];
        var orders = await db.Orders.AsNoTracking().Include(o => o.Items)
            .Where(o => o.BusinessDate >= from && o.BusinessDate <= to && !o.IsDraft &&
                o.OrderStatus != "CANCELLED" && o.FulfillmentStatus != "RETURNED")
            .ToListAsync();
        var variantIds = orders.SelectMany(o => o.Items).Select(i => i.VariantId).Distinct().ToList();
        var variants = await db.ProductVariants.IgnoreQueryFilters().AsNoTracking()
            .Where(v => v.BusinessId == db.CurrentBusinessId && variantIds.Contains(v.Id))
            .Select(v => new { v.Id, v.ProductId }).ToDictionaryAsync(v => v.Id);
        var productNames = await db.Products.IgnoreQueryFilters().AsNoTracking()
            .Where(p => p.BusinessId == db.CurrentBusinessId)
            .Select(p => new { p.Id, p.Name }).ToDictionaryAsync(p => p.Id, p => p.Name);
        var lines = new List<ProfitLine>();
        foreach (var order in orders)
        {
            var items = order.Items.Where(i => i.DeletedAt == null && i.Qty > 0).OrderBy(i => i.Id).ToList();
            foreach (var item in items)
            {
                var productId = variants.GetValueOrDefault(item.VariantId)?.ProductId ?? Guid.Empty;
                if (selected.Count > 0 && !selected.Contains(productId)) continue;
                var customerKey = order.CustomerId?.ToString() ??
                    (!string.IsNullOrWhiteSpace(order.CustomerPhone) ? "phone:" + order.CustomerPhone.Trim() : "order:" + order.Id);
                var namedCustomer = order.CustomerId.HasValue || !string.IsNullOrWhiteSpace(order.CustomerPhone);
                // Historical profit must use the unit cost saved on this sale line at confirmation,
                // never the variant's current AvgLandedCost, which can change after later purchases.
                lines.Add(new(order.BusinessDate, productId, productNames.GetValueOrDefault(productId, "Unavailable product"),
                    customerKey, string.IsNullOrWhiteSpace(order.CustomerName) ? "Unnamed customer" : order.CustomerName,
                    namedCustomer, item.Qty, item.Qty * item.UnitPrice,
                    item.UnitCostSnapshot is > 0
                        ? item.UnitCostSnapshot.Value * item.Qty
                        : null,
                    order.Id, order.OrderNo, order.Channel,
                    order.Source == "POS" || order.Channel == "SHOP" || order.Channel == "HAWKER" ? "POS" : "ORDER"));
            }
        }

        var totals = Sum(lines);
        var daily = lines.GroupBy(l => l.Date).OrderBy(g => g.Key)
            .Select(g => new DailyProfit(g.Key, Sum(g))).ToList();
        var products = lines.GroupBy(l => l.ProductId)
            .Select(g => new ProductProfit(g.Key, g.First().ProductName, Sum(g), selected.Count == 1
                ? g.GroupBy(l => l.OrderId).Select(sale => new ProductSale(sale.Key, sale.First().OrderNo,
                    sale.First().Date, sale.First().SaleType, sale.First().Channel, sale.First().CustomerName, Sum(sale)))
                    .OrderByDescending(sale => sale.Date).ThenBy(sale => sale.OrderNo).ToList()
                : null))
            .OrderByDescending(p => p.Totals.Profit ?? decimal.MinValue).ThenBy(p => p.Name).ToList();
        var customers = lines.Where(l => l.NamedCustomer).GroupBy(l => l.CustomerKey)
            .Select(g => new CustomerProfit(g.First().CustomerName, Sum(g))).ToList();
        return Ok(new
        {
            From = from, To = to, Totals = totals, Daily = daily, Products = products,
            TopDay = daily.Where(d => d.Totals.Profit.HasValue).OrderByDescending(d => d.Totals.Profit).FirstOrDefault(),
            TopProduct = products.FirstOrDefault(p => p.Totals.Profit.HasValue),
            TopBuyingCustomer = customers.OrderByDescending(c => c.Totals.Sales).ThenBy(c => c.Name).FirstOrDefault(),
            TopProfitCustomer = customers.Where(c => c.Totals.Profit.HasValue).OrderByDescending(c => c.Totals.Profit).ThenBy(c => c.Name).FirstOrDefault()
        });
    }

    private static ProfitTotals Sum(IEnumerable<ProfitLine> source)
    {
        var lines = source.ToList();
        var sales = lines.Sum(l => l.Sales);
        var missing = lines.Count(l => !l.Cost.HasValue);
        decimal? cost = missing == 0 ? lines.Sum(l => l.Cost ?? 0) : null;
        var profit = cost.HasValue ? sales - cost.Value : (decimal?)null;
        return new(sales, cost, profit, lines.Sum(l => l.Qty),
            sales > 0 && profit.HasValue ? Math.Round(profit.Value / sales * 100, 2) : null, missing);
    }

    private record ProfitLine(DateOnly Date, Guid ProductId, string ProductName, string CustomerKey,
        string CustomerName, bool NamedCustomer, decimal Qty, decimal Sales, decimal? Cost,
        Guid OrderId, string OrderNo, string Channel, string SaleType);
    public record ProfitTotals(decimal Sales, decimal? Cost, decimal? Profit, decimal Units, decimal? MarginPercent, int MissingCostLines);
    public record DailyProfit(DateOnly Date, ProfitTotals Totals);
    public record ProductProfit(Guid Id, string Name, ProfitTotals Totals, List<ProductSale>? SalesHistory);
    public record ProductSale(Guid OrderId, string OrderNo, DateOnly Date, string SaleType, string Channel,
        string CustomerName, ProfitTotals Totals);
    public record CustomerProfit(string Name, ProfitTotals Totals);
}
