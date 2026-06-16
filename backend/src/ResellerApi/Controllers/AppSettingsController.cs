using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/settings")]
[Authorize(Roles = "OWNER")]
public class AppSettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _businessContext;

    public AppSettingsController(AppDbContext db, IBusinessContext businessContext)
    {
        _db = db;
        _businessContext = businessContext;
    }

    // GET /api/v1/settings → { key: value, ... }
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var settings = await _db.AppSettings
            .AsNoTracking()
            .ToListAsync();
        var dict = settings.ToDictionary(s => s.Key, s => s.ValueJson);
        return Ok(dict);
    }

    // PUT /api/v1/settings  body: { key, value }
    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertSettingRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Key))
            return BadRequest(new { message = "Key is required." });

        var existing = await _db.AppSettings
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.BusinessId == _businessContext.CurrentBusinessId && s.Key == req.Key);

        if (existing is null)
        {
            _db.AppSettings.Add(new AppSetting
            {
                BusinessId = _businessContext.CurrentBusinessId,
                Key = req.Key,
                ValueJson = req.Value
            });
        }
        else
        {
            existing.ValueJson = req.Value;
            existing.DeletedAt = null; // restore if soft-deleted
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record UpsertSettingRequest(string Key, string Value);
