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
            string.IsNullOrWhiteSpace(request.BuildingStreet) ||
            string.IsNullOrWhiteSpace(request.City) ||
            request.Items.Count == 0)
        {
            return BadRequest(new { code = "INVALID_REQUEST", message = "Name, phone, address, and at least one item are required." });
        }

        var result = await _checkout.CreateGuestOrderAsync(request);
        return Ok(result);
    }

    [HttpGet("checkout/address")]
    public async Task<IActionResult> GetSavedAddress([FromQuery] string phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return BadRequest(new { message = "Phone number is required." });

        var address = await _checkout.GetSavedAddressAsync(phone);
        return address == null ? NotFound() : Ok(address);
    }

    [HttpPost("checkout/delivery-estimate")]
    public async Task<IActionResult> GetDeliveryEstimate([FromBody] ClientPageDeliveryEstimateRequest request)
    {
        if (request.BusinessIds.Count == 0 || string.IsNullOrWhiteSpace(request.City))
            return BadRequest(new { message = "At least one shop and a city are required." });

        var estimates = await _checkout.GetDeliveryEstimatesAsync(request);
        return Ok(estimates);
    }
}
