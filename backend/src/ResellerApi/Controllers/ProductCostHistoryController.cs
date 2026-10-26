using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.OwnerOrManager)]
[Route("api/v1/products/variants/{variantId:guid}/cost-history")]
public class ProductCostHistoryController(AppDbContext db, IBusinessContext business) : ControllerBase
{
    public record Entry(Guid Id, DateTime Date, string Kind, decimal? Quantity,
        decimal? UnitCost, decimal? PreviousCost, Guid? PurchaseId, string? PurchaseNo,
        string? Branch, string? User, string? Note);

    [HttpGet]
    public async Task<IActionResult> Get(Guid variantId, [FromQuery] int skip = 0, [FromQuery] int take = 25)
    {
        if (skip < 0 || take < 1 || take > 100 || skip > 100000) return BadRequest("Invalid page.");
        var variant = await db.ProductVariants.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == variantId && v.BusinessId == business.CurrentBusinessId);
        if (variant == null) return NotFound();

        var movements = db.StockMovements.AsNoTracking().Where(m => m.VariantId == variantId
            && m.BusinessId == business.CurrentBusinessId
            && ((m.MovementType == "PURCHASE_IN" && m.LotId != null) || m.ReferenceType == "ExistingStockCost"));
        var receipts = movements.Where(m => m.MovementType == "PURCHASE_IN");
        var lastPurchaseCost = await receipts.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Select(m => (decimal?)m.Lot!.LandedUnitCost).FirstOrDefaultAsync();
        var entries = await movements.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(skip + take).Select(m => new Entry(m.Id, m.CreatedAt,
                m.ReferenceType == "ExistingStockCost" ? "OPENING_STOCK" : "PURCHASE_RECEIVED",
                m.Qty, m.Lot == null ? null : m.Lot.LandedUnitCost, null,
                m.Lot == null ? null : m.Lot.PurchaseItem.TripId,
                m.Lot == null ? null : m.Lot.PurchaseItem.Trip.TripNo,
                m.Branch == null ? null : m.Branch.Name, m.User.Name, m.Note)).ToListAsync();
        var corrections = db.ActivityLogs.AsNoTracking().Where(a => a.BusinessId == business.CurrentBusinessId
            && a.EntityType == "ProductPurchaseCost" && a.EntityId == variantId);
        var logs = await corrections.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
            .Take(skip + take).Select(a => new { a.Id, a.CreatedAt, a.BeforeJson, a.AfterJson, User = a.User.Name }).ToListAsync();
        entries.AddRange(logs.Select(a => new Entry(a.Id, a.CreatedAt, "COST_CORRECTION", null,
            ReadCost(a.AfterJson), ReadCost(a.BeforeJson), null, null, null, a.User, null)));
        return Ok(new {
            averageCost = variant.AvgLandedCost,
            lastPurchaseCost,
            stock = await db.BranchVariantInventories.Where(i => i.VariantId == variantId).SumAsync(i => i.OnHand),
            totalCount = await movements.CountAsync() + await corrections.CountAsync(),
            items = entries.OrderByDescending(e => e.Date).ThenByDescending(e => e.Id).Skip(skip).Take(take)
        });
    }

    private static decimal? ReadCost(string? json)
    {
        if (json == null) return null;
        try {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("CostPerUnit", out var cost) && cost.TryGetDecimal(out var value) ? value : null;
        } catch (JsonException) { return null; }
    }
}
