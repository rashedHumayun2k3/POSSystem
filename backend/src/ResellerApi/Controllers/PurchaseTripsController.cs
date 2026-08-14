using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/purchase-trips")]
[Authorize(Roles = Roles.OwnerManagerWarehouse)]
public class PurchaseTripsController : ControllerBase
{
    private readonly IPurchaseTripService _svc;
    private readonly ICurrentUserService _user;

    public PurchaseTripsController(IPurchaseTripService svc, ICurrentUserService user)
    {
        _svc = svc;
        _user = user;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status)
        => Ok(await _svc.ListAsync(status));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
        => Ok(await _svc.GetAsync(id));

    [HttpPost]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Create([FromBody] CreatePurchaseTripRequest request)
    {
        try
        {
            var trip = await _svc.CreateAsync(request, _user.UserId);
            return CreatedAtAction(nameof(Get), new { id = trip.Id }, trip);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/header")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> UpdateHeader(Guid id, [FromBody] UpdateTripHeaderRequest request)
        => Ok(await _svc.UpdateHeaderAsync(id, request, _user.UserId));

    // ── Items ────────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/items")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> AddItem(Guid id, [FromBody] AddPurchaseItemRequest request)
        => Ok(await _svc.AddItemAsync(id, request, _user.UserId));

    [HttpPut("{id:guid}/items/{itemId:guid}")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> UpdateItem(Guid id, Guid itemId, [FromBody] UpdatePurchaseItemRequest request)
        => Ok(await _svc.UpdateItemAsync(id, itemId, request, _user.UserId));

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId)
    {
        await _svc.RemoveItemAsync(id, itemId, _user.UserId);
        return NoContent();
    }

    // ── Costs ────────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/costs")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> AddCost(Guid id, [FromBody] AddPurchaseTripCostRequest request)
        => Ok(await _svc.AddCostAsync(id, request, _user.UserId));

    [HttpDelete("{id:guid}/costs/{costId:guid}")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> RemoveCost(Guid id, Guid costId)
    {
        await _svc.RemoveCostAsync(id, costId, _user.UserId);
        return NoContent();
    }

    // ── Trip approval lifecycle ───────────────────────────────────────────────

    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Submit(Guid id)
        => Ok(await _svc.SubmitForApprovalAsync(id, _user.UserId));

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> Approve(Guid id)
        => Ok(await _svc.ApproveAsync(id, _user.UserId));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Cancel(Guid id)
        => Ok(await _svc.CancelAsync(id, _user.UserId));

    // ── Receive sessions ─────────────────────────────────────────────────────

    [HttpPost("{id:guid}/sessions")]
    [Authorize(Roles = Roles.OwnerWarehouse)]
    public async Task<IActionResult> CreateSession(Guid id, [FromBody] CreateReceiveSessionRequest request)
    {
        return Ok(await _svc.CreateReceiveSessionAsync(id, request, _user.UserId, _user.IsOwner));
    }

    [HttpGet("{id:guid}/sessions/{sessionId:guid}/preview")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> PreviewSession(Guid id, Guid sessionId)
        => Ok(await _svc.PreviewSessionAsync(id, sessionId));

    [HttpPost("{id:guid}/sessions/{sessionId:guid}/approve")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> ApproveSession(Guid id, Guid sessionId)
        => Ok(await _svc.ApproveSessionAsync(id, sessionId, _user.UserId));

    [HttpPost("{id:guid}/sessions/{sessionId:guid}/reject")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> RejectSession(Guid id, Guid sessionId, [FromBody] RejectSessionRequest request)
        => Ok(await _svc.RejectSessionAsync(id, sessionId, request.Reason, _user.UserId));

    // ── Close trip ────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/close")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> CloseTrip(Guid id, [FromBody] CloseTripRequest request)
    {
        try
        {
            return Ok(await _svc.CloseTripAsync(id, request.ForceCloseReason, _user.UserId));
        }
        catch (UnaccountedUnitsException ex)
        {
            return UnprocessableEntity(new
            {
                requiresForceClose = true,
                message = "Some items have unaccounted units. Provide a reason to force-close.",
                items = ex.Items.Select(i => new
                {
                    variantSku = i.VariantSku,
                    productName = i.ProductName,
                    qtyBought = i.QtyBought,
                    qtyEntered = i.QtyEntered,
                    qtyUnaccounted = i.QtyUnaccounted
                })
            });
        }
    }
}
