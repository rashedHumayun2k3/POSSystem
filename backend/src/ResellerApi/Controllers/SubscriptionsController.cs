using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Subscriptions;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/subscriptions")]
public class SubscriptionsController : ControllerBase
{
    private readonly ISubscriptionService _subscriptions;
    private readonly IConfiguration _config;

    public SubscriptionsController(ISubscriptionService subscriptions, IConfiguration config)
    {
        _subscriptions = subscriptions;
        _config = config;
    }

    private Guid CompanyId => Guid.Parse(User.FindFirst("company_id")!.Value);

    [HttpGet("plans")]
    [Authorize]
    public async Task<IActionResult> GetPlans()
    {
        return Ok(await _subscriptions.GetPurchasablePlansAsync());
    }

    [HttpGet("current")]
    [Authorize]
    public async Task<IActionResult> GetCurrent()
    {
        return Ok(await _subscriptions.GetStatusAsync(CompanyId));
    }

    [HttpPost("checkout")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Checkout([FromBody] StartCheckoutRequest request)
    {
        try
        {
            return Ok(await _subscriptions.StartCheckoutAsync(CompanyId, request));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // bKash redirects the user's own browser here (GET, no auth) after they approve or cancel
    // payment on bKash's page. We finalize the payment server-to-server, then bounce the
    // browser back to a frontend page that shows the result.
    [HttpGet("bkash/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> BkashCallback([FromQuery] string paymentID, [FromQuery] string status)
    {
        var frontendUrl = _config["Frontend:BaseUrl"] ?? "http://localhost:3000";
        try
        {
            await _subscriptions.HandleBkashCallbackAsync(paymentID, status);
            var succeeded = string.Equals(status, "success", StringComparison.OrdinalIgnoreCase);
            return Redirect($"{frontendUrl}/more/settings/subscription?payment={(succeeded ? "success" : "failed")}");
        }
        catch (InvalidOperationException)
        {
            return Redirect($"{frontendUrl}/more/settings/subscription?payment=failed");
        }
    }
}
