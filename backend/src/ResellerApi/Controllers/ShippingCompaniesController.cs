using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/shipping-companies")]
[Authorize(Roles = Roles.Owner)]
public class ShippingCompaniesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;

    public ShippingCompaniesController(AppDbContext db, IBusinessContext business)
    {
        _db = db;
        _business = business;
    }

    [HttpGet]
    public async Task<ActionResult<List<ShippingCompanyDto>>> List()
    {
        var companies = await _db.ShippingCompanies.AsNoTracking()
            .Include(x => x.Rates)
            .Where(x => x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync();
        return companies.Select(Map).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<ShippingCompanyDto>> Create(SaveShippingCompanyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Shipping company name is required." });
        if (request.AirRatePerKg is < 0 || request.SeaRatePerKg is < 0) return BadRequest(new { message = "Shipping rates cannot be negative." });
        var company = new ShippingCompany
        {
            BusinessId = _business.CurrentBusinessId,
            Name = request.Name.Trim(), Phone = request.Phone?.Trim(), LocalAddress = request.LocalAddress?.Trim(),
            ChinaAddress = request.ChinaAddress?.Trim(), Notes = request.Notes?.Trim()
        };
        AddRate(company, "AIR", request.AirRatePerKg);
        AddRate(company, "SEA", request.SeaRatePerKg);
        _db.ShippingCompanies.Add(company);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(List), Map(company));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ShippingCompanyDto>> Update(Guid id, SaveShippingCompanyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Shipping company name is required." });
        if (request.AirRatePerKg is < 0 || request.SeaRatePerKg is < 0) return BadRequest(new { message = "Shipping rates cannot be negative." });

        await using var transaction = await _db.Database.BeginTransactionAsync();
        var now = DateTime.UtcNow;
        var affected = await _db.ShippingCompanies
            .Where(x => x.Id == id)
            .ExecuteUpdateAsync(update => update
                .SetProperty(x => x.Name, request.Name.Trim())
                .SetProperty(x => x.Phone, request.Phone == null ? null : request.Phone.Trim())
                .SetProperty(x => x.LocalAddress, request.LocalAddress == null ? null : request.LocalAddress.Trim())
                .SetProperty(x => x.ChinaAddress, request.ChinaAddress == null ? null : request.ChinaAddress.Trim())
                .SetProperty(x => x.Notes, request.Notes == null ? null : request.Notes.Trim())
                .SetProperty(x => x.UpdatedAt, now));
        if (affected == 0) return NotFound(new { message = "Shipping company not found." });

        await SetRateAsync(id, "AIR", request.AirRatePerKg, now);
        await SetRateAsync(id, "SEA", request.SeaRatePerKg, now);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        var updated = await _db.ShippingCompanies.AsNoTracking()
            .Include(x => x.Rates)
            .FirstAsync(x => x.Id == id);
        return Map(updated);
    }

    private static void AddRate(ShippingCompany company, string method, decimal? amount)
    {
        if (amount.HasValue) company.Rates.Add(new ShippingCompanyRate { ShippingMethod = method, ChargeBasis = "PER_KG", RateAmount = amount.Value, CurrencyCode = "BDT" });
    }

    private async Task SetRateAsync(Guid companyId, string method, decimal? amount, DateTime now)
    {
        var rates = _db.ShippingCompanyRates.Where(x =>
            x.ShippingCompanyId == companyId && x.ShippingMethod == method && x.ChargeBasis == "PER_KG");

        if (!amount.HasValue)
        {
            await rates.ExecuteUpdateAsync(update => update
                .SetProperty(x => x.DeletedAt, now)
                .SetProperty(x => x.UpdatedAt, now));
            return;
        }

        var affected = await rates.ExecuteUpdateAsync(update => update
            .SetProperty(x => x.RateAmount, amount.Value)
            .SetProperty(x => x.UpdatedAt, now));
        if (affected == 0)
        {
            _db.ShippingCompanyRates.Add(new ShippingCompanyRate
            {
                ShippingCompanyId = companyId,
                ShippingMethod = method,
                ChargeBasis = "PER_KG",
                RateAmount = amount.Value,
                CurrencyCode = "BDT"
            });
        }
    }

    private static ShippingCompanyDto Map(ShippingCompany company) => new(company.Id, company.Name, company.Phone,
        company.LocalAddress ?? company.Address, company.ChinaAddress, company.Notes, company.IsActive,
        company.Rates.Where(x => x.DeletedAt == null && x.IsActive)
            .Select(x => new ShippingCompanyRateDto(x.Id, x.ShippingMethod, x.ChargeBasis, x.RateAmount, x.CurrencyCode, x.MinimumCharge)).ToList());
}
