using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Expenses;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.Owner)]
[Route("api/v1/planned-rates")]
public class PlannedRatesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly ICurrentUserService _user;

    public PlannedRatesController(AppDbContext db, IBusinessContext business, ICurrentUserService user)
    {
        _db = db;
        _business = business;
        _user = user;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? scope,
        [FromQuery] Guid? scopeId,
        [FromQuery] string? rateType,
        [FromQuery] bool activeOnly = false)
    {
        var q = _db.PlannedRates.AsNoTracking().Include(r => r.SetByUser).AsQueryable();

        if (!string.IsNullOrEmpty(scope))   q = q.Where(r => r.Scope == scope);
        if (scopeId.HasValue)               q = q.Where(r => r.ScopeId == scopeId);
        if (!string.IsNullOrEmpty(rateType)) q = q.Where(r => r.RateType == rateType);
        if (activeOnly)                     q = q.Where(r => r.EffectiveTo == null);

        var items = await q
            .OrderByDescending(r => r.EffectiveFrom)
            .Select(r => new PlannedRateDto(
                r.Id, r.Scope, r.ScopeId, r.RateType, r.RatePerUnit,
                r.EffectiveFrom, r.EffectiveTo, r.SetBy, r.SetByUser.Name, r.CreatedAt))
            .ToListAsync();

        return Ok(items);
    }

    // GTR-7: append-only — closes previous active rate then inserts new row
    [HttpPost]
    public async Task<IActionResult> Set([FromBody] SetPlannedRateRequest req)
    {
        if (req.RatePerUnit < 0)
            return BadRequest(new { message = "Rate per unit cannot be negative." });
        if (req.Scope is not ("BUSINESS" or "CATEGORY" or "PRODUCT"))
            return BadRequest(new { message = "Scope must be BUSINESS, CATEGORY, or PRODUCT." });
        if (req.RateType is not ("MARKETING" or "OVERHEAD"))
            return BadRequest(new { message = "RateType must be MARKETING or OVERHEAD." });

        var now = DateTime.UtcNow;

        // close existing active rate for same scope/scopeId/rateType
        var active = await _db.PlannedRates
            .Where(r => r.Scope == req.Scope
                     && r.ScopeId == req.ScopeId
                     && r.RateType == req.RateType
                     && r.EffectiveTo == null)
            .FirstOrDefaultAsync();

        if (active != null)
            active.EffectiveTo = req.EffectiveFrom;

        var newRate = new PlannedRate
        {
            BusinessId    = _business.CurrentBusinessId,
            Scope         = req.Scope,
            ScopeId       = req.ScopeId,
            RateType      = req.RateType,
            RatePerUnit   = req.RatePerUnit,
            EffectiveFrom = req.EffectiveFrom,
            EffectiveTo   = null,
            SetBy         = _user.UserId,
        };
        _db.PlannedRates.Add(newRate);
        await _db.SaveChangesAsync();

        await _db.Entry(newRate).Reference(r => r.SetByUser).LoadAsync();
        return CreatedAtAction(nameof(List), new { },
            new PlannedRateDto(newRate.Id, newRate.Scope, newRate.ScopeId, newRate.RateType,
                newRate.RatePerUnit, newRate.EffectiveFrom, newRate.EffectiveTo,
                newRate.SetBy, newRate.SetByUser.Name, newRate.CreatedAt));
    }
}
