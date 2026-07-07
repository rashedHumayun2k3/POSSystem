using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/clientpage")]
[AllowAnonymous]
public class ClientPageOrdersController : ControllerBase
{
    private readonly IClientPageCheckoutService _checkout;

    public ClientPageOrdersController(IClientPageCheckoutService checkout)
    {
        _checkout = checkout;
    }

    [HttpPost("checkout")]
    [EnableRateLimiting("clientpage-checkout")]
    public async Task<IActionResult> Checkout([FromBody] ClientPageCheckoutRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName) ||
            string.IsNullOrWhiteSpace(request.CustomerPhone) ||
            string.IsNullOrWhiteSpace(request.CustomerAddress) ||
            request.Items.Count == 0)
        {
            return BadRequest(new { code = "INVALID_REQUEST", message = "Name, phone, address, and at least one item are required." });
        }

        var result = await _checkout.CreateGuestOrderAsync(request);
        return Ok(result);
    }
}
