using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/couriers")]
[Authorize(Roles = "OWNER")]
public class CouriersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _businessContext;
    private readonly IActivityLogService _activityLog;
    private readonly ICurrentUserService _currentUser;

    public CouriersController(AppDbContext db, IBusinessContext businessContext,
        IActivityLogService activityLog, ICurrentUserService currentUser)
    {
        _db = db;
        _businessContext = businessContext;
        _activityLog = activityLog;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var couriers = await _db.Couriers
            .AsNoTracking()
            .OrderByDescending(c => c.IsDefault)
            .ThenBy(c => c.Name)
            .Select(c => new
            {
                c.Id, c.Name, c.Phone,
                c.InsideDhakaCharge, c.OutsideDhakaCharge,
                c.ReturnCharge, c.CodFeeType, c.CodFeeValue,
                c.IsDefault, c.TrackingUrlTemplate, c.IsActive
            })
            .ToListAsync();
        return Ok(couriers);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CourierRequest req)
    {
        if (req.IsDefault)
            await _db.Couriers.Where(c => c.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsDefault, false));

        var courier = new Courier
        {
            BusinessId = _businessContext.CurrentBusinessId,
            Name = req.Name.Trim(),
            Phone = req.Phone?.Trim(),
            InsideDhakaCharge = req.InsideDhakaCharge,
            OutsideDhakaCharge = req.OutsideDhakaCharge,
            ReturnCharge = req.ReturnCharge,
            CodFeeType = req.CodFeeType,
            CodFeeValue = req.CodFeeValue,
            IsDefault = req.IsDefault,
            TrackingUrlTemplate = req.TrackingUrlTemplate?.Trim(),
            IsActive = true
        };
        _db.Couriers.Add(courier);
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "CREATE", "Courier", courier.Id, null, new { courier.Name });
        return CreatedAtAction(nameof(GetAll), new { }, new
        {
            courier.Id, courier.Name, courier.Phone,
            courier.InsideDhakaCharge, courier.OutsideDhakaCharge,
            courier.ReturnCharge, courier.CodFeeType, courier.CodFeeValue,
            courier.IsDefault, courier.TrackingUrlTemplate, courier.IsActive
        });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CourierRequest req)
    {
        var courier = await _db.Couriers.FindAsync(id);
        if (courier is null) return NotFound();

        if (req.IsDefault && !courier.IsDefault)
            await _db.Couriers.Where(c => c.Id != id && c.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsDefault, false));

        var before = new { courier.Name, courier.InsideDhakaCharge, courier.OutsideDhakaCharge, courier.IsDefault };
        courier.Name = req.Name.Trim();
        courier.Phone = req.Phone?.Trim();
        courier.InsideDhakaCharge = req.InsideDhakaCharge;
        courier.OutsideDhakaCharge = req.OutsideDhakaCharge;
        courier.ReturnCharge = req.ReturnCharge;
        courier.CodFeeType = req.CodFeeType;
        courier.CodFeeValue = req.CodFeeValue;
        courier.IsDefault = req.IsDefault;
        courier.TrackingUrlTemplate = req.TrackingUrlTemplate?.Trim();
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "Courier", id, before, new { courier.Name, courier.IsDefault });
        return NoContent();
    }

    [HttpPatch("{id:guid}/toggle-active")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var courier = await _db.Couriers.FindAsync(id);
        if (courier is null) return NotFound();
        courier.IsActive = !courier.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { courier.IsActive });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var courier = await _db.Couriers.FindAsync(id);
        if (courier is null) return NotFound();
        courier.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "DELETE", "Courier", id, new { courier.Name }, null);
        return NoContent();
    }
}

public record CourierRequest(
    string Name,
    string? Phone,
    decimal InsideDhakaCharge,
    decimal OutsideDhakaCharge,
    decimal ReturnCharge,
    string CodFeeType,
    decimal CodFeeValue,
    bool IsDefault,
    string? TrackingUrlTemplate);
