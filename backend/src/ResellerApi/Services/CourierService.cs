using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Orders;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class CourierService : ICourierService
{
    private readonly AppDbContext _db;
    private readonly IActivityLogService _log;

    public CourierService(AppDbContext db, IActivityLogService log)
    {
        _db = db;
        _log = log;
    }

    // ── Couriers ──────────────────────────────────────────────────────────────

    public async Task<List<CourierDto>> ListCouriersAsync(bool activeOnly = true)
    {
        var query = _db.Couriers.AsNoTracking();
        if (activeOnly) query = query.Where(c => c.IsActive);
        return await query
            .OrderBy(c => c.Name)
            .Select(c => ToDto(c))
            .ToListAsync();
    }

    public async Task<CourierDto> CreateCourierAsync(CreateCourierRequest request, Guid userId)
    {
        var courier = new Courier
        {
            BusinessId = _db.CurrentBusinessId,
            Name = request.Name,
            InsideDhakaCharge = request.InsideDhakaCharge,
            OutsideDhakaCharge = request.OutsideDhakaCharge,
            ReturnCharge = request.ReturnCharge,
            CodFeeType = request.CodFeeType,
            CodFeeValue = request.CodFeeValue,
            Contact = request.Contact,
            TrackingUrlTemplate = request.TrackingUrlTemplate,
            IsActive = true
        };
        _db.Couriers.Add(courier);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_db.CurrentBusinessId, userId, "CREATE", "Courier", courier.Id);
        return ToDto(courier);
    }

    public async Task<CourierDto> UpdateCourierAsync(Guid id, UpdateCourierRequest request, Guid userId)
    {
        var courier = await _db.Couriers.FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Courier not found.");

        courier.Name = request.Name;
        courier.InsideDhakaCharge = request.InsideDhakaCharge;
        courier.OutsideDhakaCharge = request.OutsideDhakaCharge;
        courier.ReturnCharge = request.ReturnCharge;
        courier.CodFeeType = request.CodFeeType;
        courier.CodFeeValue = request.CodFeeValue;
        courier.Contact = request.Contact;
        courier.TrackingUrlTemplate = request.TrackingUrlTemplate;
        courier.IsActive = request.IsActive;

        await _db.SaveChangesAsync();
        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "Courier", courier.Id);
        return ToDto(courier);
    }

    // ── Delivery Men ──────────────────────────────────────────────────────────

    public async Task<List<DeliveryManDto>> ListDeliveryMenAsync(bool activeOnly = true)
    {
        var query = _db.DeliveryMen
            .AsNoTracking()
            .Include(d => d.Courier);
        var filtered = activeOnly ? query.Where(d => d.IsActive) : query;
        return await filtered
            .OrderBy(d => d.Name)
            .Select(d => new DeliveryManDto(d.Id, d.Name, d.Phone, d.CourierId, d.Courier != null ? d.Courier.Name : null, d.CostPerDelivery, d.IsActive))
            .ToListAsync();
    }

    public async Task<DeliveryManDto> CreateDeliveryManAsync(CreateDeliveryManRequest request, Guid userId)
    {
        var dm = new DeliveryMan
        {
            BusinessId = _db.CurrentBusinessId,
            Name = request.Name,
            Phone = request.Phone,
            CourierId = request.CourierId,
            CostPerDelivery = request.CostPerDelivery,
            IsActive = true
        };
        _db.DeliveryMen.Add(dm);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_db.CurrentBusinessId, userId, "CREATE", "DeliveryMan", dm.Id);
        return new DeliveryManDto(dm.Id, dm.Name, dm.Phone, dm.CourierId, null, dm.CostPerDelivery, dm.IsActive);
    }

    public async Task<DeliveryManDto> UpdateDeliveryManAsync(Guid id, UpdateDeliveryManRequest request, Guid userId)
    {
        var dm = await _db.DeliveryMen.Include(d => d.Courier).FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new KeyNotFoundException("Delivery man not found.");

        dm.Name = request.Name;
        dm.Phone = request.Phone;
        dm.CourierId = request.CourierId;
        dm.CostPerDelivery = request.CostPerDelivery;
        dm.IsActive = request.IsActive;

        await _db.SaveChangesAsync();
        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "DeliveryMan", dm.Id);
        return new DeliveryManDto(dm.Id, dm.Name, dm.Phone, dm.CourierId, dm.Courier?.Name, dm.CostPerDelivery, dm.IsActive);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static CourierDto ToDto(Courier c) => new(
        c.Id, c.Name, c.InsideDhakaCharge, c.OutsideDhakaCharge, c.ReturnCharge,
        c.CodFeeType, c.CodFeeValue, c.Contact, c.TrackingUrlTemplate, c.IsActive
    );
}
