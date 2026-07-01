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
            .OrderBy(c => c.IsSystem ? 0 : 1).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Code, c.Name, c.IsSystem, c.IsDefault })
            .ToListAsync();
        return Ok(cats);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ExpenseCategoryRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Name is required." });

        var code = "CUSTOM_" + req.Name.Trim().ToUpperInvariant().Replace(" ", "_");
        var cat = new ExpenseCategory
        {
            BusinessId = _businessContext.CurrentBusinessId,
            Code       = code,
            Name       = req.Name.Trim(),
            IsSystem   = false,
            IsDefault  = req.IsDefault,
            IsActive   = true
        };
        _db.ExpenseCategories.Add(cat);
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "CREATE", "ExpenseCategory", cat.Id, null, new { cat.Name });
        return CreatedAtAction(nameof(GetAll), new { }, new { cat.Id, cat.Code, cat.Name, cat.IsSystem, cat.IsDefault });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ExpenseCategoryRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Name is required." });

        var cat = await _db.ExpenseCategories.FindAsync(id);
        if (cat is null) return NotFound();
        if (cat.IsSystem)
            return Conflict(new { message = "System categories cannot be renamed." });

        cat.Name      = req.Name.Trim();
        cat.IsDefault = req.IsDefault;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var cat = await _db.ExpenseCategories.FindAsync(id);
        if (cat is null) return NotFound();
        if (cat.IsSystem)
            return Conflict(new { message = "System categories cannot be deleted." });

        cat.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "DELETE", "ExpenseCategory", id, new { cat.Name }, null);
        return NoContent();
    }
}

public record ExpenseCategoryRequest(string Name, bool IsDefault = false);
