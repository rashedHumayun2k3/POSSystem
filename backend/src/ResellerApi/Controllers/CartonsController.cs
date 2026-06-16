using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Cartons;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/cartons")]
[Authorize(Roles = Roles.OwnerManagerWarehouse)]
public class CartonsController : ControllerBase
{
    private readonly ICartonService _svc;
    private readonly ICurrentUserService _user;

    public CartonsController(ICartonService svc, ICurrentUserService user)
    {
        _svc = svc;
        _user = user;
    }

    // ── List & detail ─────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? tripId,
        [FromQuery] string? status,
        [FromQuery] Guid? variantId)
        => Ok(await _svc.ListAsync(tripId, status, variantId));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        try { return Ok(await _svc.GetAsync(id)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    // ── Create ────────────────────────────────────────────────────────────────

    [HttpPost("bulk")]
    [Authorize(Roles = Roles.OwnerWarehouse)]
    public async Task<IActionResult> BulkCreate([FromBody] BulkCreateCartonsRequest request)
    {
        try { return Ok(await _svc.BulkCreateAsync(request, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    // ── Update header ─────────────────────────────────────────────────────────

    [HttpPatch("{id:guid}")]
    [Authorize(Roles = Roles.OwnerWarehouse)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCartonRequest request)
    {
        try { return Ok(await _svc.UpdateAsync(id, request, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    // ── Open carton (enter contents) ──────────────────────────────────────────

    [HttpPost("{id:guid}/open")]
    [Authorize(Roles = Roles.OwnerWarehouse)]
    public async Task<IActionResult> Open(Guid id, [FromBody] OpenCartonRequest request)
    {
        try { return Ok(await _svc.OpenAsync(id, request, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // ── Record labeling ───────────────────────────────────────────────────────

    [HttpPost("{id:guid}/items/{itemId:guid}/label")]
    [Authorize(Roles = Roles.OwnerWarehouse)]
    public async Task<IActionResult> LabelItem(Guid id, Guid itemId, [FromBody] LabelCartonItemRequest request)
    {
        try { return Ok(await _svc.LabelItemAsync(id, itemId, request, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return UnprocessableEntity(new { message = ex.Message }); }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Delete(Guid id)
    {
        try { await _svc.DeleteAsync(id, _user.UserId); return NoContent(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // ── Reports ───────────────────────────────────────────────────────────────

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
        => Ok(await _svc.GetSummaryAsync());

    [HttpGet("location")]
    public async Task<IActionResult> LocationLookup([FromQuery] Guid variantId)
        => Ok(await _svc.LocationLookupAsync(variantId));

    [HttpGet("damaged")]
    public async Task<IActionResult> Damaged()
        => Ok(await _svc.GetDamagedAsync());

    [HttpGet("trips")]
    public async Task<IActionResult> TripsWithCartons()
        => Ok(await _svc.GetTripsWithCartonsAsync());
}
