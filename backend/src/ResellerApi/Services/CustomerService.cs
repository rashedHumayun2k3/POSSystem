using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Orders;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class CustomerService : ICustomerService
{
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

        var unpaidBalances = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId != null && ids.Contains(o.CustomerId.Value) && o.PaymentStatus != "PAID" && o.PaymentStatus != "REFUNDED" && o.OrderStatus != "CANCELLED")
            .GroupBy(o => o.CustomerId!.Value)
            .Select(g => new { CustomerId = g.Key, Balance = g.Sum(o => o.DeliveryChargeCustomer + o.Items.Sum(i => i.Qty * i.UnitPrice) - (o.DiscountValue ?? 0) - o.AdvancePaid) })
            .ToListAsync();

        var orderCounts = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId != null && ids.Contains(o.CustomerId.Value))
            .GroupBy(o => o.CustomerId!.Value)
            .Select(g => new { CustomerId = g.Key, Count = g.Count() })
            .ToListAsync();

        return customers.Select(c => new CustomerSummaryDto(
            c.Id, c.Name, c.Phone, c.Address, c.CreditLimit, c.StoreCreditBalance, c.IsRejecterFlag,
            orderCounts.FirstOrDefault(x => x.CustomerId == c.Id)?.Count ?? 0,
            Math.Max(0, unpaidBalances.FirstOrDefault(x => x.CustomerId == c.Id)?.Balance ?? 0)
        )).ToList();
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
        var orderCount = await _db.Orders.AsNoTracking().CountAsync(o => o.CustomerId == c.Id);
        var unpaid = await _db.Orders.AsNoTracking()
            .Where(o => o.CustomerId == c.Id && o.PaymentStatus != "PAID" && o.PaymentStatus != "REFUNDED" && o.OrderStatus != "CANCELLED")
            .SumAsync(o => (decimal?)o.AdvancePaid) ?? 0;
        // simplified unpaid = sum of totals - sum of advances (use payment records for accuracy)
        return new CustomerSummaryDto(c.Id, c.Name, c.Phone, c.Address, c.CreditLimit, c.StoreCreditBalance, c.IsRejecterFlag, orderCount, 0);
    }
}
