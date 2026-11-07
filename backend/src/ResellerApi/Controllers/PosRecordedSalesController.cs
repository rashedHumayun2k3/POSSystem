using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Services;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/orders/pos-recorded")]
public class PosRecordedSalesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateOnly date)
    {
        if (date == default) return BadRequest(new { message = "Choose a valid sale date." });
        // Keep global business, branch and soft-delete filters on orders and their lines.
        var orders = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Payments)
            .Where(o => o.BusinessDate == date && !o.IsDraft && o.OrderStatus != "CANCELLED"
                && o.FulfillmentStatus != "RETURNED" && (o.PaymentStatus == "PAID" || (o.PaymentTerms == "CREDIT" && o.ConfirmedAt != null))
                && (o.Source == "POS" || o.Channel == "SHOP" || o.Channel == "HAWKER"))
            .OrderByDescending(o => o.CreatedAt).ThenBy(o => o.Id).ToListAsync();
        var variantIds = orders.SelectMany(o => o.Items).Select(i => i.VariantId).Distinct().ToList();
        var variants = await db.ProductVariants.IgnoreQueryFilters().AsNoTracking()
            .Where(v => v.BusinessId == db.CurrentBusinessId && variantIds.Contains(v.Id))
            .Select(v => new { v.Id, v.ProductId }).ToDictionaryAsync(v => v.Id);
        var productIds = variants.Values.Select(v => v.ProductId).Distinct().ToList();
        var names = await db.Products.IgnoreQueryFilters().AsNoTracking()
            .Where(p => p.BusinessId == db.CurrentBusinessId && productIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name }).ToDictionaryAsync(p => p.Id, p => p.Name);
        var sales = orders.Select(o => new RecordedSale(o.Id, o.OrderNo, o.CustomerName, o.CreatedAt,
            o.Items.Where(i => i.DeletedAt == null && i.Qty > 0).Select(i => {
                var productId = variants.GetValueOrDefault(i.VariantId)?.ProductId ?? Guid.Empty;
                return new RecordedItem(productId, names.GetValueOrDefault(productId, "Unavailable product"), i.Qty, i.Qty * i.UnitPrice);
            }).ToList(), o.Payments.Where(p => p.DeletedAt == null).Select(p => p.Method).Distinct().ToList(),
            o.PaymentStatus, Math.Max(0, OrderFinancials.ComputeOrderRevenue(o) - o.Payments.Sum(p => p.Amount)))).ToList();
        var products = sales.SelectMany(s => s.Items).GroupBy(i => i.ProductId)
            .Select(g => new RecordedItem(g.Key, g.First().Name, g.Sum(i => i.Qty), g.Sum(i => i.Amount)))
            .OrderBy(p => p.Name).ToList();
        return Ok(new RecordedReport(date, sales.Count, products.Sum(p => p.Qty), products.Sum(p => p.Amount), products, sales));
    }
    public record RecordedItem(Guid ProductId, string Name, decimal Qty, decimal Amount);
    public record RecordedSale(Guid Id, string OrderNo, string CustomerName, DateTime CreatedAt, List<RecordedItem> Items, List<string> PaymentMethods, string PaymentStatus, decimal DueAmount);
    public record RecordedReport(DateOnly Date, int SaleCount, decimal Qty, decimal Amount, List<RecordedItem> Products, List<RecordedSale> Sales);
}
