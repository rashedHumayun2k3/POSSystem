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
        var company = await _db.ShippingCompanies.Include(x => x.Rates).FirstOrDefaultAsync(x => x.Id == id);
        if (company == null) return NotFound(new { message = "Shipping company not found." });
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest(new { message = "Shipping company name is required." });
        if (request.AirRatePerKg is < 0 || request.SeaRatePerKg is < 0) return BadRequest(new { message = "Shipping rates cannot be negative." });
        company.Name = request.Name.Trim(); company.Phone = request.Phone?.Trim(); company.LocalAddress = request.LocalAddress?.Trim();
        company.ChinaAddress = request.ChinaAddress?.Trim(); company.Notes = request.Notes?.Trim();
        SetRate(company, "AIR", request.AirRatePerKg);
        SetRate(company, "SEA", request.SeaRatePerKg);
        await _db.SaveChangesAsync();
        return Map(company);
    }

    private static void AddRate(ShippingCompany company, string method, decimal? amount)
    {
        if (amount.HasValue) company.Rates.Add(new ShippingCompanyRate { ShippingMethod = method, ChargeBasis = "PER_KG", RateAmount = amount.Value, CurrencyCode = "BDT" });
    }

    private static void SetRate(ShippingCompany company, string method, decimal? amount)
    {
        var rate = company.Rates.FirstOrDefault(x => x.ShippingMethod == method && x.DeletedAt == null);
        if (!amount.HasValue) { if (rate != null) rate.DeletedAt = DateTime.UtcNow; return; }
        if (rate == null) company.Rates.Add(new ShippingCompanyRate { ShippingMethod = method, ChargeBasis = "PER_KG", RateAmount = amount.Value, CurrencyCode = "BDT" });
        else rate.RateAmount = amount.Value;
    }

    private static ShippingCompanyDto Map(ShippingCompany company) => new(company.Id, company.Name, company.Phone,
        company.LocalAddress ?? company.Address, company.ChinaAddress, company.Notes, company.IsActive,
        company.Rates.Where(x => x.DeletedAt == null && x.IsActive)
            .Select(x => new ShippingCompanyRateDto(x.Id, x.ShippingMethod, x.ChargeBasis, x.RateAmount, x.CurrencyCode, x.MinimumCharge)).ToList());
}
