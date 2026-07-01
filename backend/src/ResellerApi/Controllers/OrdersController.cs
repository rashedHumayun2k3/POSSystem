using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Orders;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _svc;
    private readonly ICurrentUserService _user;

    public OrdersController(IOrderService svc, ICurrentUserService user)
    {
        _svc = svc;
        _user = user;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? orderStatus,
        [FromQuery] string? fulfillmentStatus,
        [FromQuery] string? channel,
        [FromQuery] string? q,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
        => Ok(await _svc.ListAsync(orderStatus, fulfillmentStatus, channel, q, from, to));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
        => Ok(await _svc.GetAsync(id, _user.CanSeeCosts));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey)
    {
        var req = request with { ClientUid = request.ClientUid ?? idempotencyKey };
        var order = await _svc.CreateAsync(req, _user.UserId);
        return CreatedAtAction(nameof(Get), new { id = order.Id }, order);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrderRequest request)
        => Ok(await _svc.UpdateAsync(id, request, _user.UserId));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Delete(Guid id, [FromBody] DeleteOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { message = "Deletion reason is required." });
        await _svc.DeleteAsync(id, request.Reason, _user.UserId);
        return NoContent();
    }

    [HttpPost("{id:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid id)
    {
        try { return Ok(await _svc.ConfirmAsync(id, _user.UserId)); }
        catch (StockUnavailableException ex)
        {
            return Conflict(new { code = "STOCK_UNAVAILABLE", message = ex.Message, items = ex.UnavailableItems });
        }
    }

    [HttpPost("{id:guid}/pack")]
    public async Task<IActionResult> Pack(Guid id)
        => Ok(await _svc.PackAsync(id, _user.UserId));

    [HttpPost("{id:guid}/handover")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> Handover(Guid id, [FromBody] HandoverOrderRequest request)
        => Ok(await _svc.HandoverAsync(id, request, _user.UserId));

    [HttpPost("{id:guid}/delivered")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> Deliver(Guid id)
        => Ok(await _svc.DeliverAsync(id, _user.UserId));

    [HttpPost("{id:guid}/return")]
    public async Task<IActionResult> Return(Guid id, [FromBody] ReturnOrderRequest request)
        => Ok(await _svc.ReturnAsync(id, request, _user.UserId));

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelOrderRequest request)
        => Ok(await _svc.CancelAsync(id, request, _user.UserId));

    [HttpPost("{id:guid}/payments")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] AddOrderPaymentRequest request)
        => Ok(await _svc.AddPaymentAsync(id, request, _user.UserId));

    [HttpGet("{id:guid}/challan")]
    public async Task<IActionResult> Challan(Guid id)
    {
        var pdf = await _svc.GetChallanPdfAsync(id);
        return File(pdf, "application/pdf", $"challan-{id}.pdf");
    }

    [HttpPost("{id:guid}/claim")]
    public async Task<IActionResult> Claim(Guid id)
    {
        await _svc.ClaimAsync(id, _user.UserId);
        return Ok();
    }
}
