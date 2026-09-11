using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.SupplierReturns;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

// Deals exclusively in cost data (UnitCost, ResolutionAmount) — kept Owner/Manager only end to
// end rather than adding per-field DTO shaping like ProductsController does for STAFF (GTR-10).
[ApiController]
[Route("api/v1/supplier-returns")]
[Authorize(Roles = Roles.OwnerOrManager)]
public class SupplierReturnsController : ControllerBase
{
    private readonly ISupplierReturnService _svc;
    private readonly ICurrentUserService _user;

    public SupplierReturnsController(ISupplierReturnService svc, ICurrentUserService user)
    {
        _svc = svc;
        _user = user;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] Guid? supplierId)
        => Ok(await _svc.ListAsync(status, supplierId));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
        => Ok(await _svc.GetAsync(id));

    [HttpGet("damaged-stock")]
    public async Task<IActionResult> ListDamagedStock([FromQuery] Guid? branchId, [FromQuery] string? search)
        => Ok(await _svc.ListDamagedStockAsync(branchId, search));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSupplierReturnRequest request)
    {
        var ret = await _svc.CreateAsync(request, _user.UserId);
        return CreatedAtAction(nameof(Get), new { id = ret.Id }, ret);
    }

    // ── Items ────────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/items")]
    public async Task<IActionResult> AddItem(Guid id, [FromBody] AddSupplierReturnItemRequest request)
        => Ok(await _svc.AddItemAsync(id, request));

    [HttpPut("{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> UpdateItem(Guid id, Guid itemId, [FromBody] UpdateSupplierReturnItemRequest request)
        => Ok(await _svc.UpdateItemAsync(id, itemId, request));

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId)
    {
        await _svc.RemoveItemAsync(id, itemId);
        return NoContent();
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id)
        => Ok(await _svc.SubmitAsync(id, _user.UserId));

    [HttpPost("{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id)
        => Ok(await _svc.ResolveAsync(id, _user.UserId));

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
        => Ok(await _svc.CancelAsync(id, _user.UserId));
}
