using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.Services;

namespace ResellerApi.Controllers;

[ApiController, Authorize, Route("api/v1/notifications")]
public class OrderNotificationsController(OrderNotificationService service) : ControllerBase
{
    [HttpGet("orders")]
    public async Task<IActionResult> List(int page = 1) => Ok(await service.List(page));

    [HttpPost("orders/{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id)
    {
        try { return Ok(await service.Read(id)); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Notification not found." }); }
    }

    [HttpPut("device")]
    public async Task<IActionResult> Register(RegisterPushDevice input)
    {
        try { await service.Register(input); return NoContent(); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
        catch (UnauthorizedAccessException e) { return StatusCode(403, new { message = e.Message }); }
    }

    public record DisableDevice(string Token);
    [HttpPost("device/disable")]
    public async Task<IActionResult> Disable(DisableDevice input) { await service.Disable(input.Token); return NoContent(); }
}
