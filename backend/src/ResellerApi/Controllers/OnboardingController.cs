using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Auth;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/onboarding")]
[Authorize]
public class OnboardingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _businessContext;
    private readonly ICurrentUserService _currentUser;
    private readonly IActivityLogService _activityLog;
    private readonly ICategoryPresetService _presets;
    private readonly IValidator<SetBusinessTypesRequest> _validator;
    private readonly IValidator<SetSalesChannelsRequest> _salesChannelsValidator;

    public OnboardingController(
        AppDbContext db,
        IBusinessContext businessContext,
        ICurrentUserService currentUser,
        IActivityLogService activityLog,
        ICategoryPresetService presets,
        IValidator<SetBusinessTypesRequest> validator,
        IValidator<SetSalesChannelsRequest> salesChannelsValidator)
    {
        _db = db;
        _businessContext = businessContext;
        _currentUser = currentUser;
        _activityLog = activityLog;
        _presets = presets;
        _validator = validator;
        _salesChannelsValidator = salesChannelsValidator;
    }

    [HttpPost("business-type")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> SetBusinessTypes([FromBody] SetBusinessTypesRequest request)
    {
        var validation = await _validator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        var business = await _db.Businesses.FirstOrDefaultAsync(b => b.Id == _businessContext.CurrentBusinessId)
            ?? throw new KeyNotFoundException("Business not found.");

        if (business.OnboardingCompletedAt != null)
            return Conflict(new { code = "ONBOARDING_ALREADY_DONE", message = "Business type has already been set for this business." });

        var selectedTypes = request.BusinessTypes.Distinct().ToArray();
        var categories = new List<CategoryDto>();
        foreach (var businessType in selectedTypes)
            categories.AddRange(await _presets.ApplyPresetAsync(business.Id, businessType));

        business.BusinessTypesJson = BusinessTypes.ToJson(selectedTypes);
        business.OnboardingCompletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _activityLog.LogAsync(business.Id, _currentUser.UserId, "UPDATE", "Business", business.Id,
            null, new { BusinessTypes = selectedTypes });

        return Ok(new { businessTypes = selectedTypes, categories });
    }

    // How the business sells (Shop/POS, Hawker, Online) — distinct from industry business-type above.
    // Re-callable any time (not gated by OnboardingCompletedAt): a hawker may add Online later, etc.
    [HttpPost("sales-channels")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> SetSalesChannels([FromBody] SetSalesChannelsRequest request)
    {
        var validation = await _salesChannelsValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        var business = await _db.Businesses.FirstOrDefaultAsync(b => b.Id == _businessContext.CurrentBusinessId)
            ?? throw new KeyNotFoundException("Business not found.");

        var selectedChannels = request.SalesChannels.Distinct().ToArray();
        var previousChannels = SalesChannels.ParseJson(business.SalesChannelsJson);
        business.SalesChannelsJson = SalesChannels.ToJson(selectedChannels);
        await _db.SaveChangesAsync();

        await _activityLog.LogAsync(business.Id, _currentUser.UserId, "UPDATE", "Business", business.Id,
            new { SalesChannels = previousChannels }, new { SalesChannels = selectedChannels });

        return Ok(new { salesChannels = selectedChannels });
    }
}
