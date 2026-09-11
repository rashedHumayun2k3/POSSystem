using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Expenses;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.Owner)]
[Route("api/v1/marketing-budgets")]
public class MarketingBudgetsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly ICurrentUserService _user;

    public MarketingBudgetsController(AppDbContext db, IBusinessContext business, ICurrentUserService user)
    {
        _db = db;
        _business = business;
        _user = user;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int? year, [FromQuery] int? month)
    {
        var q = _db.MarketingBudgets.AsNoTracking().Include(b => b.SetByUser).AsQueryable();
        if (year.HasValue)  q = q.Where(b => b.Year == year.Value);
        if (month.HasValue) q = q.Where(b => b.Month == month.Value);

        var items = await q
            .OrderByDescending(b => b.Year).ThenByDescending(b => b.Month)
            .Select(b => new MarketingBudgetDto(
                b.Id, b.Year, b.Month, b.Scope, b.ScopeId,
                b.BudgetAmount, b.SetBy, b.SetByUser.Name))
            .ToListAsync();

        return Ok(items);
    }

    // Upsert: same year/month/scope/scopeId = update existing
    [HttpPost]
    public async Task<IActionResult> Set([FromBody] SetMarketingBudgetRequest req)
    {
        if (req.Month < 1 || req.Month > 12)
            return BadRequest(new { message = "Month must be 1–12." });
        if (req.BudgetAmount < 0)
            return BadRequest(new { message = "Budget amount cannot be negative." });
        if (req.Scope is not ("BUSINESS" or "CATEGORY" or "PRODUCT"))
            return BadRequest(new { message = "Scope must be BUSINESS, CATEGORY, or PRODUCT." });

        var existing = await _db.MarketingBudgets.FirstOrDefaultAsync(b =>
            b.Year == req.Year && b.Month == req.Month
            && b.Scope == req.Scope && b.ScopeId == req.ScopeId);

        if (existing != null)
        {
            existing.BudgetAmount = req.BudgetAmount;
            existing.SetBy        = _user.UserId;
            await _db.SaveChangesAsync();
            await _db.Entry(existing).Reference(b => b.SetByUser).LoadAsync();
            return Ok(new MarketingBudgetDto(existing.Id, existing.Year, existing.Month,
                existing.Scope, existing.ScopeId, existing.BudgetAmount,
                existing.SetBy, existing.SetByUser.Name));
        }

        var budget = new MarketingBudget
        {
            BusinessId   = _business.CurrentBusinessId,
            Year         = req.Year,
            Month        = req.Month,
            Scope        = req.Scope,
            ScopeId      = req.ScopeId,
            BudgetAmount = req.BudgetAmount,
            SetBy        = _user.UserId,
        };
        _db.MarketingBudgets.Add(budget);
        await _db.SaveChangesAsync();
        await _db.Entry(budget).Reference(b => b.SetByUser).LoadAsync();
        return CreatedAtAction(nameof(List), new { },
            new MarketingBudgetDto(budget.Id, budget.Year, budget.Month, budget.Scope,
                budget.ScopeId, budget.BudgetAmount, budget.SetBy, budget.SetByUser.Name));
    }
}
