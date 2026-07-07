using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Remittances;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class RemittanceService : IRemittanceService
{
    private readonly AppDbContext _db;
    private readonly IActivityLogService _log;

    public RemittanceService(AppDbContext db, IActivityLogService log)
    {
        _db = db;
        _log = log;
    }

    public async Task<List<CourierCodSummaryDto>> GetSummaryAsync()
    {
        var couriers = await _db.Couriers.AsNoTracking()
            .Where(c => c.IsActive)
            .ToListAsync();

        var pendingOrders = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .Where(o => o.CourierId != null && o.CodRemittanceStatus == "PENDING")
            .ToListAsync();

        var historyCounts = await _db.CourierRemittances
            .AsNoTracking()
            .GroupBy(r => r.CourierId)
            .Select(g => new { CourierId = g.Key, Count = g.Count() })
            .ToListAsync();

        var result = new List<CourierCodSummaryDto>();
        foreach (var courier in couriers)
        {
            var orders = pendingOrders.Where(o => o.CourierId == courier.Id).ToList();
            var histCount = historyCounts.FirstOrDefault(h => h.CourierId == courier.Id)?.Count ?? 0;

            if (orders.Count == 0 && histCount == 0) continue;

            var totalReceivable = orders.Sum(o =>
            {
                var total = ComputeTotal(o);
                var paid = o.Payments.Sum(p => p.Amount);
                return Math.Max(0, total - paid);
            });

            result.Add(new CourierCodSummaryDto(
                courier.Id, courier.Name,
                orders.Count, totalReceivable, histCount
            ));
        }

        return result;
    }

    public async Task<List<OrderInCourierBoardDto>> GetCourierOrdersAsync(Guid courierId, string? status)
    {
        var query = _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .Where(o => o.CourierId == courierId)
            .Where(o => o.FulfillmentStatus == "DELIVERED" || o.FulfillmentStatus == "IN_TRANSIT");

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(o => o.CodRemittanceStatus == status);

        var orders = await query
            .OrderByDescending(o => o.DeliveredAt ?? o.HandedOverAt)
            .Take(100)
            .ToListAsync();

        return orders.Select(o =>
        {
            var total = ComputeTotal(o);
            var paid = o.Payments.Sum(p => p.Amount);
            return new OrderInCourierBoardDto(
                o.Id, o.OrderNo, o.CustomerName, o.CustomerPhone,
                total, paid, Math.Max(0, total - paid),
                o.FulfillmentStatus, o.CodRemittanceStatus,
                o.DeliveredAt, o.TrackingNo
            );
        }).ToList();
    }

    public async Task<CourierRemittanceDto> CreateAsync(CreateRemittanceRequest request, Guid userId)
    {
        var orders = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .Where(o => request.OrderIds.Contains(o.Id))
            .ToListAsync();

        if (orders.Any(o => o.CourierId != request.CourierId))
            throw new InvalidOperationException("All orders must belong to the specified courier.");

        if (orders.Any(o => o.CodRemittanceStatus == "REMITTED"))
            throw new InvalidOperationException("One or more orders are already remitted.");

        var remittanceNo = await GenerateRemittanceNoAsync();

        var remittance = new CourierRemittance
        {
            BusinessId = _db.CurrentBusinessId,
            RemittanceNo = remittanceNo,
            CourierId = request.CourierId,
            Amount = request.Amount,
            RemittedAt = request.RemittedAt,
            Method = request.Method,
            Reference = request.Reference,
            Note = request.Note,
            RecordedBy = userId
        };

        _db.CourierRemittances.Add(remittance);
        await _db.SaveChangesAsync();

        foreach (var order in orders)
        {
            order.RemittanceId = remittance.Id;
            order.CodRemittanceStatus = "REMITTED";
        }
        await _db.SaveChangesAsync();

        await _log.LogAsync(_db.CurrentBusinessId, userId, "CREATE", "CourierRemittance", remittance.Id);

        return await GetRemittanceDtoAsync(remittance.Id);
    }

    public async Task<List<CourierRemittanceDto>> ListAsync()
    {
        var remittances = await _db.CourierRemittances
            .AsNoTracking()
            .Include(r => r.Courier)
            .Include(r => r.RecordedByUser)
            .Include(r => r.Orders)
            .OrderByDescending(r => r.RemittedAt)
            .Take(100)
            .ToListAsync();

        return remittances.Select(r => new CourierRemittanceDto(
            r.Id, r.RemittanceNo, r.CourierId, r.Courier?.Name ?? "",
            r.Amount, r.RemittedAt, r.Method, r.Reference, r.Note,
            r.Orders.Count, r.RecordedByUser?.Name ?? "", r.CreatedAt
        )).ToList();
    }

    private async Task<CourierRemittanceDto> GetRemittanceDtoAsync(Guid id)
    {
        var r = await _db.CourierRemittances
            .AsNoTracking()
            .Include(r => r.Courier)
            .Include(r => r.RecordedByUser)
            .Include(r => r.Orders)
            .FirstOrDefaultAsync(r => r.Id == id)
            ?? throw new KeyNotFoundException("Remittance not found.");

        return new CourierRemittanceDto(
            r.Id, r.RemittanceNo, r.CourierId, r.Courier?.Name ?? "",
            r.Amount, r.RemittedAt, r.Method, r.Reference, r.Note,
            r.Orders.Count, r.RecordedByUser?.Name ?? "", r.CreatedAt
        );
    }

    private async Task<string> GenerateRemittanceNoAsync()
    {
        // IgnoreQueryFilters so a soft-deleted remittance's number is never reused — its row
        // still occupies the (BusinessId, RemittanceNo) unique index. Same class of bug as
        // ProductService.GenerateSkuAsync / OrderService.GenerateOrderNoAsync.
        var count = await _db.CourierRemittances.IgnoreQueryFilters()
            .CountAsync(r => r.BusinessId == _db.CurrentBusinessId) + 1;
        return $"RMT-{count:D4}";
    }

    private static decimal ComputeTotal(Order o)
    {
        var subtotal = o.Items.Where(i => i.DeletedAt == null).Sum(i => i.Qty * i.UnitPrice);
        decimal discount = 0;
        if (o.DiscountType != null && o.DiscountValue.HasValue)
        {
            discount = o.DiscountType == "PERCENT"
                ? Math.Round(subtotal * o.DiscountValue.Value / 100, 2)
                : o.DiscountValue.Value;
        }
        return subtotal - discount + o.DeliveryChargeCustomer;
    }
}
