using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/expense-categories")]
[Authorize(Roles = "OWNER")]
public class ExpenseCategoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _businessContext;
    private readonly IActivityLogService _activityLog;
    private readonly ICurrentUserService _currentUser;

    public ExpenseCategoriesController(AppDbContext db, IBusinessContext businessContext,
        IActivityLogService activityLog, ICurrentUserService currentUser)
    {
        _db = db;
        _businessContext = businessContext;
        _activityLog = activityLog;
        _currentUser = currentUser;
    }

    [HttpGet]
    [Authorize] // staff can read categories (needed when logging expenses)
    public async Task<IActionResult> GetAll()
    {
        var cats = await _db.ExpenseCategories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.IsDefault ? 0 : 1).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.IsDefault })
            .ToListAsync();
        return Ok(cats);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ExpenseCategoryRequest req)
    {
        var cat = new ExpenseCategory
        {
            BusinessId = _businessContext.CurrentBusinessId,
            Name = req.Name.Trim(),
            IsDefault = req.IsDefault,
            IsActive = true
        };
        _db.ExpenseCategories.Add(cat);
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "CREATE", "ExpenseCategory", cat.Id, null, new { cat.Name });
        return CreatedAtAction(nameof(GetAll), new { }, new { cat.Id, cat.Name, cat.IsDefault });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ExpenseCategoryRequest req)
    {
        var cat = await _db.ExpenseCategories.FindAsync(id);
        if (cat is null) return NotFound();
        cat.Name = req.Name.Trim();
        cat.IsDefault = req.IsDefault;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var cat = await _db.ExpenseCategories.FindAsync(id);
        if (cat is null) return NotFound();
        cat.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "DELETE", "ExpenseCategory", id, new { cat.Name }, null);
        return NoContent();
    }
}

public record ExpenseCategoryRequest(string Name, bool IsDefault = false);
