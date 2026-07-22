using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Feedback;
using ResellerApi.DTOs.PlatformAdmin;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/platform-admin")]
public class PlatformAdminController : ControllerBase
{
    private readonly IPlatformAdminService _admin;
    private readonly IFeedbackService _feedback;

    public PlatformAdminController(IPlatformAdminService admin, IFeedbackService feedback)
    {
        _admin = admin;
        _feedback = feedback;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] PlatformAdminLoginRequest request)
    {
        try
        {
            return Ok(await _admin.LoginAsync(request));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpGet("companies")]
    [Authorize(Roles = Roles.PlatformAdmin)]
    public async Task<IActionResult> GetCompanies([FromQuery] string? search)
    {
        return Ok(await _admin.GetCompaniesAsync(search));
    }

    [HttpPost("companies/{id:guid}/status")]
    [Authorize(Roles = Roles.PlatformAdmin)]
    public async Task<IActionResult> SetCompanyStatus(Guid id, [FromBody] SetCompanyStatusRequest request)
    {
        try
        {
            await _admin.SetCompanyStatusAsync(id, request);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("companies/{id:guid}/marketplace-visibility")]
    [Authorize(Roles = Roles.PlatformAdmin)]
    public async Task<IActionResult> SetMarketplaceVisibility(Guid id, [FromBody] SetMarketplaceVisibilityRequest request)
    {
        try
        {
            await _admin.SetMarketplaceVisibilityAsync(id, request);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("companies/{id:guid}/extend-subscription")]
    [Authorize(Roles = Roles.PlatformAdmin)]
    public async Task<IActionResult> ExtendSubscription(Guid id, [FromBody] ExtendSubscriptionRequest request)
    {
        try
        {
            await _admin.ExtendSubscriptionAsync(id, request);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("stats")]
    [Authorize(Roles = Roles.PlatformAdmin)]
    public async Task<IActionResult> GetStats()
    {
        return Ok(await _admin.GetStatsAsync());
    }

    [HttpGet("feedback")]
    [Authorize(Roles = Roles.PlatformAdmin)]
    public async Task<IActionResult> GetFeedback([FromQuery] string? search)
    {
        return Ok(await _feedback.ListAllAsync(search));
    }

    [HttpPost("feedback/{id:guid}/reply")]
    [Authorize(Roles = Roles.PlatformAdmin)]
    public async Task<IActionResult> ReplyToFeedback(Guid id, [FromBody] ReplyToFeedbackRequest request)
    {
        try
        {
            await _feedback.ReplyAsync(id, User.Identity?.Name ?? "Platform Admin", request);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
