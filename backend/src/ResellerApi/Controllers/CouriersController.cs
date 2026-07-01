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
    [AllowAnonymous]
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

    // ── Delivery Men ──────────────────────────────────────────────────────────

    [HttpGet("delivery-men")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDeliveryMen([FromQuery] bool activeOnly = true)
    {
        var query = _db.DeliveryMen.AsNoTracking().Include(d => d.Courier).AsQueryable();
        if (activeOnly) query = query.Where(d => d.IsActive);
        var list = await query.OrderBy(d => d.Name)
            .Select(d => new { d.Id, d.Name, d.Phone, d.CourierId, CourierName = d.Courier != null ? d.Courier.Name : null, d.CostPerDelivery, d.IsActive })
            .ToListAsync();
        return Ok(list);
    }

    [HttpPost("delivery-men")]
    public async Task<IActionResult> CreateDeliveryMan([FromBody] DeliveryManRequest req)
    {
        var dm = new DeliveryMan
        {
            BusinessId = _businessContext.CurrentBusinessId,
            Name = req.Name.Trim(),
            Phone = req.Phone.Trim(),
            CourierId = req.CourierId,
            CostPerDelivery = req.CostPerDelivery,
            IsActive = true
        };
        _db.DeliveryMen.Add(dm);
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId, "CREATE", "DeliveryMan", dm.Id);
        return Ok(new { dm.Id, dm.Name, dm.Phone, dm.CourierId, dm.CostPerDelivery, dm.IsActive });
    }

    [HttpPatch("delivery-men/{id:guid}")]
    public async Task<IActionResult> UpdateDeliveryMan(Guid id, [FromBody] DeliveryManRequest req)
    {
        var dm = await _db.DeliveryMen.FindAsync(id);
        if (dm is null) return NotFound();
        dm.Name = req.Name.Trim();
        dm.Phone = req.Phone.Trim();
        dm.CourierId = req.CourierId;
        dm.CostPerDelivery = req.CostPerDelivery;
        await _db.SaveChangesAsync();
        return Ok(new { dm.Id, dm.Name, dm.Phone, dm.CourierId, dm.CostPerDelivery, dm.IsActive });
    }

    [HttpPatch("delivery-men/{id:guid}/toggle-active")]
    public async Task<IActionResult> ToggleDeliveryManActive(Guid id)
    {
        var dm = await _db.DeliveryMen.FindAsync(id);
        if (dm is null) return NotFound();
        dm.IsActive = !dm.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { dm.IsActive });
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

public record DeliveryManRequest(
    string Name,
    string Phone,
    Guid? CourierId,
    decimal CostPerDelivery);
