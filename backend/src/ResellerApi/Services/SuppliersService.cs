using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Suppliers;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class SuppliersService : ISuppliersService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public SuppliersService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
    }

    public async Task<List<SupplierDto>> ListAsync(string? search, int? limit, string? sort, string? country)
    {
        var q = _db.Suppliers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(s => s.Name.Contains(search) ||
                              (s.Phone != null && s.Phone.Contains(search)));

        if (!string.IsNullOrWhiteSpace(country))
            q = q.Where(s => s.Country == country);

        q = sort == "recent"
            ? q.OrderByDescending(s => s.LastUsedAt).ThenBy(s => s.Name)
            : q.OrderBy(s => s.Name);

        if (limit.HasValue)
            q = q.Take(limit.Value);

        return await q.Select(s => new SupplierDto(
            s.Id, s.Name, s.Address, s.Phone, s.Country, s.Notes, s.UsageCount, s.LastUsedAt
        )).ToListAsync();
    }

    public async Task<SupplierDto> GetAsync(Guid id)
    {
        var s = await _db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException("Supplier not found.");
        return new SupplierDto(s.Id, s.Name, s.Address, s.Phone, s.Country, s.Notes, s.UsageCount, s.LastUsedAt);
    }

    public async Task<SupplierDto> CreateAsync(CreateSupplierRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Supplier name is required.");

        var supplier = new Supplier
        {
            BusinessId = _business.CurrentBusinessId,
            Name = request.Name.Trim(),
            Address = request.Address?.Trim(),
            Phone = request.Phone?.Trim(),
            Country = request.Country?.Trim(),
            Notes = request.Notes?.Trim()
        };
        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Supplier", supplier.Id);
        return new SupplierDto(supplier.Id, supplier.Name, supplier.Address, supplier.Phone, supplier.Country, supplier.Notes, supplier.UsageCount, supplier.LastUsedAt);
    }

    public async Task<SupplierDto> UpdateAsync(Guid id, UpdateSupplierRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Supplier name is required.");

        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new KeyNotFoundException("Supplier not found.");

        supplier.Name = request.Name.Trim();
        supplier.Address = request.Address?.Trim();
        supplier.Phone = request.Phone?.Trim();
        supplier.Country = request.Country?.Trim();
        supplier.Notes = request.Notes?.Trim();
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Supplier", supplier.Id);
        return new SupplierDto(supplier.Id, supplier.Name, supplier.Address, supplier.Phone, supplier.Country, supplier.Notes, supplier.UsageCount, supplier.LastUsedAt);
    }

    public async Task DeleteAsync(Guid id, Guid userId)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id)
            ?? throw new KeyNotFoundException("Supplier not found.");
        supplier.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "DELETE", "Supplier", supplier.Id);
    }
}
