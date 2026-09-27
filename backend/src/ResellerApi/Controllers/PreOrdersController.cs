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
        await using var tx = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var sequence = await _db.PreOrders.IgnoreQueryFilters().CountAsync(x => x.BusinessId == _business.CurrentBusinessId && x.RequestedAt.Date == DateTime.UtcNow.Date) + 1;
        var order = new PreOrder { BusinessId = _business.CurrentBusinessId, BranchId = branchId, PreOrderNo = $"PRE-{DateTime.UtcNow:yyMMdd}-{sequence:D4}", Source = "POS", CustomerName = Clean(request.CustomerName), CustomerPhone = Clean(request.CustomerPhone), CustomerEmail = Clean(request.CustomerEmail), CustomerReference = Clean(request.CustomerReference), CustomerNote = Clean(request.CustomerNote), StaffNote = Clean(request.StaffNote), ExpectedDate = request.ExpectedDate, PickupDeadline = request.PickupDeadline, CreatedByUserId = _user.UserId };
        foreach (var requested in request.Items)
        {
            var variant = variants[requested.VariantId];
            var values = VariantLabel(variant.VariantValuesJson);
            order.Items.Add(new PreOrderItem { BusinessId = _business.CurrentBusinessId, ProductId = variant.ProductId, VariantId = variant.Id, QuantityRequested = requested.Quantity, QuantityReserved = 0, UnitPriceSnapshot = variant.PriceOverride ?? variant.Product.SellingPrice, ProductNameSnapshot = variant.Product.Name, VariantNameSnapshot = string.IsNullOrWhiteSpace(values) ? variant.Sku : $"{variant.Sku} Â· {values}" });
        }
        order.Status = "NEW";
        AddActivity(order, "Created", order.StaffNote);
        _db.PreOrders.Add(order); await _db.SaveChangesAsync(); await tx.CommitAsync();
        return CreatedAtAction(nameof(Get), new { id = order.Id }, ToDto(order));
    }

    [Authorize(Roles = "OWNER,MANAGER")]
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancelPreOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { message = "Enter a cancellation reason." });
        var order = await _db.PreOrders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        if (order is null) return NotFound(new { message = "Pre-order not found." });
        if (order.Status is "CANCELLED" or "COMPLETED" or "RESOLVED") return BadRequest(new { message = "This pre-order can no longer be cancelled." });
        foreach (var item in order.Items.Where(x => x.QuantityReserved > 0))
        {
            var stock = await _db.BranchVariantInventories.FirstOrDefaultAsync(x => x.BranchId == order.BranchId && x.VariantId == item.VariantId);
            if (stock is not null) stock.Committed = Math.Max(0, stock.Committed - item.QuantityReserved);
            item.QuantityReserved = 0;
        }
        order.Status = "CANCELLED"; order.CancelledAt = DateTime.UtcNow; order.CancellationReason = request.Reason.Trim();
        AddActivity(order, "Cancelled", order.CancellationReason);
        await _db.SaveChangesAsync(); return Ok(ToDto(order));
    }

    [Authorize(Roles = "OWNER,MANAGER")]
    [HttpPost("{id:guid}/workflow")]
    public async Task<IActionResult> UpdateWorkflow(Guid id, UpdatePreOrderRequest request)
    {
        var order = await _db.PreOrders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        if (order is null) return NotFound(new { message = "Pre-order not found." });
        if (order.Status is "RESOLVED" or "CANCELLED" or "COMPLETED")
            return BadRequest(new { message = "This request is already closed." });
        if (request.Note?.Length > 2000 || request.PurchaseReference?.Length > 200)
            return BadRequest(new { message = "Note or purchase reference is too long." });
        switch (request.Action)
        {
            case "START_REVIEW":
                if (order.Status != "NEW") return BadRequest(new { message = "This request is already in progress." });
                order.Status = "IN_PROGRESS";
                break;
            case "UPDATE":
                order.ExpectedDate = request.ExpectedDate;
                order.PurchaseReference = Clean(request.PurchaseReference);
                order.StaffNote = Clean(request.Note);
                break;
            case "CONTACTED":
                if (order.Status != "IN_PROGRESS") return BadRequest(new { message = "Start review before recording contact." });
                break;
            case "RESOLVE":
                if (order.Status != "IN_PROGRESS") return BadRequest(new { message = "Start review before resolving." });
                if (request.Outcome is not ("PURCHASED" or "NOTIFIED" or "DECLINED" or "UNAVAILABLE"))
                    return BadRequest(new { message = "Choose a resolution outcome." });
                order.Status = "RESOLVED";
                order.ResolutionOutcome = request.Outcome;
                order.CompletedAt = DateTime.UtcNow;
                break;
            default: return BadRequest(new { message = "Unknown workflow action." });
        }
        AddActivity(order, request.Action, Clean(request.Note), request.Action == "UPDATE"
            ? $"Purchase reference: {order.PurchaseReference ?? "—"}; Expected date: {order.ExpectedDate:yyyy-MM-dd}"
            : request.Outcome);
        await _db.SaveChangesAsync();
        return Ok(ToDto(order));
    }

    private sealed record Activity(DateTime At, Guid? UserId, string Actor, string Action, string? Note, string? Detail);
    private void AddActivity(PreOrder order, string action, string? note, string? detail = null)
    {
        var entries = JsonSerializer.Deserialize<List<Activity>>(order.ActivityJson) ?? [];
        entries.Add(new Activity(DateTime.UtcNow, _user.UserId, User.Identity?.Name ?? User.FindFirst("name")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "Staff", action, note, detail));
        order.ActivityJson = JsonSerializer.Serialize(entries);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string VariantLabel(string json) { try { var values = JsonSerializer.Deserialize<Dictionary<string,string>>(json); return values is null ? "" : string.Join(" / ", values.Values); } catch { return ""; } }
    private static object ToDto(PreOrder x) => new { x.Id, x.PreOrderNo, x.Source, x.Status, x.BranchId, x.CustomerName, x.CustomerPhone, x.CustomerEmail, x.CustomerReference, x.CustomerNote, x.StaffNote, x.RequestedAt, x.ExpectedDate, x.PickupDeadline, x.CompletedAt, x.CancelledAt, x.CancellationReason, x.PurchaseReference, x.ResolutionOutcome, Activities = JsonSerializer.Deserialize<List<Activity>>(x.ActivityJson), Items = x.Items.Select(i => new { i.Id, i.ProductId, i.VariantId, ProductName = i.ProductNameSnapshot, VariantName = i.VariantNameSnapshot, QuantityRequested = i.QuantityRequested, QuantityReserved = i.QuantityReserved, QuantityWaiting = Math.Max(0, i.QuantityRequested - i.QuantityReserved - i.QuantityFulfilled), i.QuantityFulfilled, i.UnitPriceSnapshot }) };
}
