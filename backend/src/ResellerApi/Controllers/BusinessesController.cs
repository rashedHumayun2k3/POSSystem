using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.ExternalOrders;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = "OWNER")]
[Route("api/v1/businesses")]
public class BusinessesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _businessContext;
    private readonly IActivityLogService _activityLog;
    private readonly ICurrentUserService _currentUser;

    public BusinessesController(AppDbContext db, IBusinessContext businessContext,
        IActivityLogService activityLog, ICurrentUserService currentUser)
    {
        _db = db;
        _businessContext = businessContext;
        _activityLog = activityLog;
        _currentUser = currentUser;
    }

    [HttpGet("storefront-settings")]
    public async Task<IActionResult> GetStorefrontSettings()
    {
        var business = await _db.Businesses.FindAsync(_businessContext.CurrentBusinessId);
        if (business is null) return NotFound();
        return Ok(new {
            business.ShowOnMarketplace, business.Subdomain, business.StorefrontEnabled, business.LogoUrl,
            business.ExternalWebsiteUrl
        });
    }

    [HttpPatch("storefront-settings")]
    public async Task<IActionResult> UpdateStorefrontSettings([FromBody] StorefrontSettingsRequest request)
    {
        var business = await _db.Businesses.FindAsync(_businessContext.CurrentBusinessId);
        if (business is null) return NotFound();

        var before = new { business.ShowOnMarketplace };
        business.ShowOnMarketplace = request.ShowOnMarketplace;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "Business", business.Id, before, new { business.ShowOnMarketplace });

        return Ok(new { business.ShowOnMarketplace });
    }

    // Also used as the logo on the A4 online-order invoice (see OrderInvoicePdfGenerator) —
    // not just storefront branding.
    [HttpPatch("logo")]
    public async Task<IActionResult> UpdateLogo([FromBody] UpdateLogoRequest request)
    {
        var business = await _db.Businesses.FindAsync(_businessContext.CurrentBusinessId);
        if (business is null) return NotFound();

        var before = new { business.LogoUrl };
        business.LogoUrl = string.IsNullOrWhiteSpace(request.LogoUrl) ? null : request.LogoUrl;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "Business", business.Id, before, new { business.LogoUrl });

        return Ok(new { business.LogoUrl });
    }

    // Claiming a subdomain also turns the shop page on immediately (StorefrontEnabled = true) —
    // one action, shop page works right away. Use PATCH storefront-enabled afterwards to take it
    // offline again without losing the claimed slug.
    [HttpPut("subdomain")]
    public async Task<IActionResult> SetSubdomain([FromBody] SetSubdomainRequest request)
    {
        var validationError = SubdomainValidator.Validate(request.Subdomain);
        if (validationError != null)
            return BadRequest(new { message = validationError });

        var normalized = SubdomainValidator.Normalize(request.Subdomain);

        var business = await _db.Businesses.FindAsync(_businessContext.CurrentBusinessId);
        if (business is null) return NotFound();

        var taken = await _db.Businesses.IgnoreQueryFilters()
            .AnyAsync(b => b.Id != business.Id && b.DeletedAt == null && b.Subdomain == normalized);
        if (taken)
            return Conflict(new { message = "This subdomain is already taken. Please choose another." });

        var before = new { business.Subdomain, business.StorefrontEnabled };
        business.Subdomain = normalized;
        business.StorefrontEnabled = true;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "Business", business.Id, before, new { business.Subdomain, business.StorefrontEnabled });

        return Ok(new { business.Subdomain, business.StorefrontEnabled });
    }

    [HttpPatch("website")]
    public async Task<IActionResult> UpdateWebsite([FromBody] UpdateWebsiteRequest request)
    {
        var business = await _db.Businesses.FindAsync(_businessContext.CurrentBusinessId);
        if (business is null) return NotFound();

        var url = NormalizeWebsiteUrl(request.WebsiteUrl);
        if (!string.IsNullOrEmpty(url) && !Uri.IsWellFormedUriString(url, UriKind.Absolute))
            return BadRequest(new { message = "Enter a full URL, e.g. https://example.com" });

        var before = new { business.ExternalWebsiteUrl };
        business.ExternalWebsiteUrl = string.IsNullOrEmpty(url) ? null : url;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "Business", business.Id, before, new { business.ExternalWebsiteUrl });

        return Ok(new { business.ExternalWebsiteUrl });
    }

    [HttpPatch("storefront-enabled")]
    public async Task<IActionResult> SetStorefrontEnabled([FromBody] SetStorefrontEnabledRequest request)
    {
        var business = await _db.Businesses.FindAsync(_businessContext.CurrentBusinessId);
        if (business is null) return NotFound();

        if (request.Enabled && string.IsNullOrEmpty(business.Subdomain))
            return BadRequest(new { message = "Claim a subdomain first." });

        var before = new { business.StorefrontEnabled };
        business.StorefrontEnabled = request.Enabled;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "Business", business.Id, before, new { business.StorefrontEnabled });

        return Ok(new { business.StorefrontEnabled });
    }

    [HttpGet("external-order-integrations")]
    public async Task<ActionResult<List<ExternalOrderIntegrationDto>>> ListExternalOrderIntegrations()
    {
        var integrations = await _db.ExternalOrderIntegrations
            .AsNoTracking()
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new ExternalOrderIntegrationDto(i.Id, i.Name, i.SourceWebsiteUrl, i.IsActive, i.CreatedAt))
            .ToListAsync();
        return Ok(integrations);
    }

    [HttpPost("external-order-integrations")]
    public async Task<ActionResult<CreateExternalOrderIntegrationResponse>> CreateExternalOrderIntegration(
        [FromBody] CreateExternalOrderIntegrationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Integration name is required." });

        var url = NormalizeWebsiteUrl(request.SourceWebsiteUrl);
        if (!string.IsNullOrEmpty(url) && !Uri.IsWellFormedUriString(url, UriKind.Absolute))
            return BadRequest(new { message = "Enter a full URL, e.g. https://example.com" });

        var apiKey = $"eord_{Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)).ToLowerInvariant()}";
        var integration = new ExternalOrderIntegration
        {
            BusinessId = _businessContext.CurrentBusinessId,
            Name = request.Name.Trim(),
            SourceWebsiteUrl = string.IsNullOrEmpty(url) ? null : url,
            KeyHash = ExternalOrderService.HashSecret(apiKey),
            CreatedBy = _currentUser.UserId,
        };

        _db.ExternalOrderIntegrations.Add(integration);
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "CREATE", "ExternalOrderIntegration", integration.Id, null, new { integration.Name, integration.SourceWebsiteUrl });

        return Ok(new CreateExternalOrderIntegrationResponse(
            integration.Id, integration.Name, apiKey, integration.SourceWebsiteUrl, integration.IsActive));
    }

    [HttpPatch("external-order-integrations/{id:guid}/active")]
    public async Task<IActionResult> SetExternalOrderIntegrationActive(Guid id, [FromBody] SetExternalOrderIntegrationActiveRequest request)
    {
        var integration = await _db.ExternalOrderIntegrations.FirstOrDefaultAsync(i => i.Id == id);
        if (integration is null) return NotFound();

        var before = new { integration.IsActive };
        integration.IsActive = request.IsActive;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "ExternalOrderIntegration", integration.Id, before, new { integration.IsActive });

        return Ok(new { integration.IsActive });
    }

    [HttpDelete("external-order-integrations/{id:guid}")]
    public async Task<IActionResult> DeleteExternalOrderIntegration(Guid id)
    {
        var integration = await _db.ExternalOrderIntegrations.FirstOrDefaultAsync(i => i.Id == id);
        if (integration is null) return NotFound();

        var before = new { integration.Name, integration.SourceWebsiteUrl, integration.IsActive };
        integration.IsActive = false;
        integration.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "DELETE", "ExternalOrderIntegration", integration.Id, before, null);

        return NoContent();
    }

    private static string? NormalizeWebsiteUrl(string? value)
    {
        var url = value?.Trim();
        if (string.IsNullOrEmpty(url)) return null;
        return url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
               url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            ? url
            : $"https://{url}";
    }
}

public record StorefrontSettingsRequest(bool ShowOnMarketplace);
public record SetSubdomainRequest(string Subdomain);
public record SetStorefrontEnabledRequest(bool Enabled);
public record UpdateLogoRequest(string? LogoUrl);
public record UpdateWebsiteRequest(string? WebsiteUrl);
public record SetExternalOrderIntegrationActiveRequest(bool IsActive);
