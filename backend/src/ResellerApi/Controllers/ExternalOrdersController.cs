using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResellerApi.DTOs.ExternalOrders;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/v1/external/orders")]
[EnableRateLimiting("external-orders")]
public class ExternalOrdersController : ControllerBase
{
    private readonly IExternalOrderService _svc;

    public ExternalOrdersController(IExternalOrderService svc)
    {
        _svc = svc;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ExternalOrderCreateRequest request)
    {
        var apiKey = Request.Headers["X-External-Order-Key"].FirstOrDefault();
        try
        {
            return Ok(await _svc.CreateAsync(apiKey ?? "", request));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
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
}
