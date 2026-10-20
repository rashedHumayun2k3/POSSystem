using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.OwnerManagerWarehouse)]
[Route("api/v1/purchase-trips/{tripId:guid}/payments")]
public sealed class PurchasePaymentsController(PurchasePaymentService service, ICurrentUserService user) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid tripId)
    {
        try { return Ok(await service.List(tripId)); }
        catch (KeyNotFoundException e) { return NotFound(new { message = e.Message }); }
    }
    [HttpPost]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> Pay(Guid tripId, PurchasePaymentRequest request)
    {
        try { return Ok(await service.Pay(tripId, request, user.UserId)); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
        catch (KeyNotFoundException e) { return NotFound(new { message = e.Message }); }
        catch (InvalidOperationException e) { return Conflict(new { message = e.Message }); }
    }
}
