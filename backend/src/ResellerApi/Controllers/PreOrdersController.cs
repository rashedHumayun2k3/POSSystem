using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.PreOrders;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/pre-orders")]
[Authorize(Roles = "OWNER,MANAGER,STAFF")]
public class PreOrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly ICurrentUserService _user;
    public PreOrdersController(AppDbContext db, IBusinessContext business, ICurrentUserService user)
    { _db = db; _business = business; _user = user; }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status)
    {
        var query = _db.PreOrders.AsNoTracking().Include(x => x.Items).OrderByDescending(x => x.RequestedAt).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status.Trim().ToUpperInvariant());
        return Ok((await query.Take(200).ToListAsync()).Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var item = await _db.PreOrders.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        return item is null ? NotFound(new { message = "Pre-order not found." }) : Ok(ToDto(item));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreatePreOrderRequest request)
    {
        if (request.Items is null || request.Items.Count == 0) return BadRequest(new { message = "Select at least one product." });
        if (request.Items.Any(x => x.Quantity <= 0)) return BadRequest(new { message = "Quantity must be greater than zero." });
        var branchId = _business.CurrentBranchId ?? await _db.Branches.Where(x => x.IsDefault && x.IsActive).Select(x => (Guid?)x.Id).FirstOrDefaultAsync();
        if (branchId is null) return BadRequest(new { message = "Select an active branch before creating a pre-order." });
        var variantIds = request.Items.Select(x => x.VariantId).Distinct().ToList();
        if (variantIds.Count != request.Items.Count) return BadRequest(new { message = "Each product variant can only be added once." });
        var variants = await _db.ProductVariants.Include(x => x.Product).Where(x => variantIds.Contains(x.Id) && x.Product.Status == "ACTIVE").ToDictionaryAsync(x => x.Id);
        if (variants.Count != variantIds.Count) return BadRequest(new { message = "One or more products are unavailable." });
        var inventory = await _db.BranchVariantInventories.Where(x => x.BranchId == branchId && variantIds.Contains(x.VariantId)).ToDictionaryAsync(x => x.VariantId);
        await using var tx = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var sequence = await _db.PreOrders.IgnoreQueryFilters().CountAsync(x => x.BusinessId == _business.CurrentBusinessId && x.RequestedAt.Date == DateTime.UtcNow.Date) + 1;
        var order = new PreOrder { BusinessId = _business.CurrentBusinessId, BranchId = branchId, PreOrderNo = $"PRE-{DateTime.UtcNow:yyMMdd}-{sequence:D4}", Source = "POS", CustomerName = Clean(request.CustomerName), CustomerPhone = Clean(request.CustomerPhone), CustomerEmail = Clean(request.CustomerEmail), CustomerReference = Clean(request.CustomerReference), CustomerNote = Clean(request.CustomerNote), StaffNote = Clean(request.StaffNote), ExpectedDate = request.ExpectedDate, PickupDeadline = request.PickupDeadline, CreatedByUserId = _user.UserId };
        var fullyAvailable = true;
        foreach (var requested in request.Items)
        {
            var variant = variants[requested.VariantId]; inventory.TryGetValue(requested.VariantId, out var stock);
            var available = Math.Max(0, stock?.Available ?? 0); if (available < requested.Quantity) fullyAvailable = false;
            var reserved = request.ReserveAvailableStock ? Math.Min(available, requested.Quantity) : 0;
            if (reserved > 0 && stock is not null) stock.Committed += reserved;
            var values = VariantLabel(variant.VariantValuesJson);
            order.Items.Add(new PreOrderItem { BusinessId = _business.CurrentBusinessId, ProductId = variant.ProductId, VariantId = variant.Id, QuantityRequested = requested.Quantity, QuantityReserved = reserved, UnitPriceSnapshot = variant.PriceOverride ?? variant.Product.SellingPrice, ProductNameSnapshot = variant.Product.Name, VariantNameSnapshot = string.IsNullOrWhiteSpace(values) ? variant.Sku : $"{variant.Sku} · {values}" });
        }
        order.Status = fullyAvailable ? "CONFIRMED" : "WAITING_STOCK";
        _db.PreOrders.Add(order); await _db.SaveChangesAsync(); await tx.CommitAsync();
        return CreatedAtAction(nameof(Get), new { id = order.Id }, ToDto(order));
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancelPreOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "Enter a cancellation reason." });
        var order = await _db.PreOrders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        if (order is null) return NotFound(new { message = "Pre-order not found." });
        if (order.Status is "CANCELLED" or "COMPLETED") return BadRequest(new { message = "This pre-order can no longer be cancelled." });
        foreach (var item in order.Items.Where(x => x.QuantityReserved > 0))
        {
            var stock = await _db.BranchVariantInventories.FirstOrDefaultAsync(x => x.BranchId == order.BranchId && x.VariantId == item.VariantId);
            if (stock is not null) stock.Committed = Math.Max(0, stock.Committed - item.QuantityReserved);
            item.QuantityReserved = 0;
        }
        order.Status = "CANCELLED"; order.CancelledAt = DateTime.UtcNow; order.CancellationReason = request.Reason.Trim();
        await _db.SaveChangesAsync(); return Ok(ToDto(order));
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string VariantLabel(string json) { try { var values = JsonSerializer.Deserialize<Dictionary<string,string>>(json); return values is null ? "" : string.Join(" / ", values.Values); } catch { return ""; } }
    private static object ToDto(PreOrder x) => new { x.Id, x.PreOrderNo, x.Source, x.Status, x.BranchId, x.CustomerName, x.CustomerPhone, x.CustomerEmail, x.CustomerReference, x.CustomerNote, x.StaffNote, x.RequestedAt, x.ExpectedDate, x.PickupDeadline, x.CompletedAt, x.CancelledAt, x.CancellationReason, Items = x.Items.Select(i => new { i.Id, i.ProductId, i.VariantId, ProductName = i.ProductNameSnapshot, VariantName = i.VariantNameSnapshot, QuantityRequested = i.QuantityRequested, QuantityReserved = i.QuantityReserved, QuantityWaiting = Math.Max(0, i.QuantityRequested - i.QuantityReserved - i.QuantityFulfilled), i.QuantityFulfilled, i.UnitPriceSnapshot }) };
}
