using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Orders;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class CustomerService : ICustomerService
{
    // "Serial rejecter" warning threshold — 2+ returns within a customer's last 4 orders.
    private const int RecentWindowSize = 4;
    private const int SerialRejecterThreshold = 2;

    private readonly AppDbContext _db;

    public CustomerService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<CustomerSummaryDto>> ListAsync(string? q)
    {
        var query = _db.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var lower = q.ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(lower) ||
                c.Phone.Contains(q));
        }

        var customers = await query
            .OrderBy(c => c.Name)
            .Take(50)
            .ToListAsync();

        var ids = customers.Select(c => c.Id).ToList();

        var unpaidBalances = await UnpaidBalancesAsync(ids);
        var orderSummaries = await OrderSummariesAsync(ids);

        return customers.Select(c =>
            BuildFromParts(c, orderSummaries.GetValueOrDefault(c.Id), unpaidBalances.GetValueOrDefault(c.Id))
        ).ToList();
    }

    public async Task<CustomerSummaryDto?> FindByPhoneAsync(string phone)
    {
        var c = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Phone == phone);
        if (c == null) return null;
        return await BuildDto(c);
    }

    public async Task<CustomerSummaryDto> GetAsync(Guid id)
    {
        var c = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException("Customer not found.");
        return await BuildDto(c);
    }

    public async Task<CustomerSummaryDto> UpdateAsync(Guid id, UpdateCustomerRequest request, Guid userId)
    {
        var c = await _db.Customers.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException("Customer not found.");

        c.Name = request.Name;
        if (request.Address != null) c.Address = request.Address;
        if (request.CreditLimit.HasValue) c.CreditLimit = request.CreditLimit.Value;
        if (request.Note != null) c.Note = request.Note;

        await _db.SaveChangesAsync();
        return await BuildDto(c);
    }

    private async Task<CustomerSummaryDto> BuildDto(Customer c)
    {
        var unpaid = await UnpaidBalancesAsync(new List<Guid> { c.Id });
        var orders = await OrderSummariesAsync(new List<Guid> { c.Id });
        return BuildFromParts(c, orders.GetValueOrDefault(c.Id), unpaid.GetValueOrDefault(c.Id));
    }

    private static CustomerSummaryDto BuildFromParts(Customer c, OrderSummary? orders, decimal unpaidBalance)
    {
        var recentReturnCount = orders?.RecentReturnCount ?? 0;
        var recentOrderCount = orders?.RecentOrderCount ?? 0;

        return new CustomerSummaryDto(
            c.Id, c.Name, c.Phone, c.Address, c.CreditLimit, c.StoreCreditBalance,
            recentReturnCount >= SerialRejecterThreshold,
            recentReturnCount, recentOrderCount,
            orders?.OrderCount ?? 0, orders?.ReturnCount ?? 0, orders?.LastOrderAt,
            unpaidBalance
        );
    }

    private async Task<Dictionary<Guid, decimal>> UnpaidBalancesAsync(List<Guid> customerIds)
    {
        var rows = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId != null && customerIds.Contains(o.CustomerId.Value) &&
                        o.PaymentStatus != "PAID" && o.PaymentStatus != "REFUNDED" && o.OrderStatus != "CANCELLED")
            .GroupBy(o => o.CustomerId!.Value)
            .Select(g => new { CustomerId = g.Key, Balance = g.Sum(o => o.DeliveryChargeCustomer + o.Items.Sum(i => i.Qty * i.UnitPrice) - (o.DiscountValue ?? 0) - o.AdvancePaid) })
            .ToListAsync();

        return rows.ToDictionary(r => r.CustomerId, r => Math.Max(0, r.Balance));
    }

    private record OrderSummary(int OrderCount, int ReturnCount, DateTime? LastOrderAt, int RecentReturnCount, int RecentOrderCount);

    // Recent-window stats (last N orders, chronologically) can't be expressed as a plain SQL
    // aggregate, so this pulls the lightweight per-order fields needed and finishes the grouping
    // in memory — fine at this scale (bounded to the same customer id list ListAsync already caps
    // at 50, or a single customer for the profile page).
    private async Task<Dictionary<Guid, OrderSummary>> OrderSummariesAsync(List<Guid> customerIds)
    {
        var rows = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId != null && customerIds.Contains(o.CustomerId.Value))
            .Select(o => new { CustomerId = o.CustomerId!.Value, o.FulfillmentStatus, o.CreatedAt })
            .ToListAsync();

        return rows.GroupBy(r => r.CustomerId).ToDictionary(g => g.Key, g =>
        {
            var recent = g.OrderByDescending(r => r.CreatedAt).Take(RecentWindowSize).ToList();
            return new OrderSummary(
                g.Count(),
                g.Count(r => r.FulfillmentStatus == "RETURNED"),
                g.Max(r => (DateTime?)r.CreatedAt),
                recent.Count(r => r.FulfillmentStatus == "RETURNED"),
                recent.Count
            );
        });
    }
}
