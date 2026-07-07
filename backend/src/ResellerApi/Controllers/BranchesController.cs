using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/branches")]
public class BranchesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _businessContext;
    private readonly IActivityLogService _activityLog;
    private readonly ICurrentUserService _currentUser;
    private readonly ISubscriptionService _subscriptions;

    public BranchesController(AppDbContext db, IBusinessContext businessContext,
        IActivityLogService activityLog, ICurrentUserService currentUser, ISubscriptionService subscriptions)
    {
        _db = db;
        _businessContext = businessContext;
        _activityLog = activityLog;
        _currentUser = currentUser;
        _subscriptions = subscriptions;
    }

    // OWNER/MANAGER see every branch; STAFF/WAREHOUSE only the branches assigned to them.
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var query = _db.Branches.AsNoTracking().OrderByDescending(b => b.IsDefault).ThenBy(b => b.Name).AsQueryable();

        if (!_currentUser.CanSeeCosts)
            query = query.Where(b => b.UserBranches.Any(ub => ub.UserId == _currentUser.UserId));

        var branches = await query
            .Select(b => new { b.Id, b.Name, b.Code, b.Address, b.Phone, b.IsActive, b.IsDefault })
            .ToListAsync();
        return Ok(branches);
    }

    // The current user's assigned branches — used by the frontend to auto-select or show a
    // branch picker right after login/business-switch. OWNER/MANAGER can access every branch
    // in the business (no explicit assignment needed); STAFF/WAREHOUSE only see their
    // UserBranches rows.
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        if (_currentUser.CanSeeCosts)
        {
            var allBranches = await _db.Branches.AsNoTracking()
                .Where(b => b.IsActive)
                .OrderByDescending(b => b.IsDefault).ThenBy(b => b.Name)
                .Select(b => new { b.Id, b.Name, b.Code, b.IsActive, IsDefault = b.IsDefault })
                .ToListAsync();
            return Ok(allBranches);
        }

        var branches = await _db.UserBranches.AsNoTracking()
            .Where(ub => ub.UserId == _currentUser.UserId)
            .Join(_db.Branches.AsNoTracking(), ub => ub.BranchId, b => b.Id,
                (ub, b) => new { b.Id, b.Name, b.Code, b.IsActive, ub.IsDefault })
            .Where(b => b.IsActive)
            .OrderByDescending(b => b.IsDefault).ThenBy(b => b.Name)
            .ToListAsync();
        return Ok(branches);
    }

    [HttpPost]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Create([FromBody] BranchRequest req)
    {
        var companyId = Guid.Parse(User.FindFirst("company_id")!.Value);
        try
        {
            await _subscriptions.EnsureCanAddBranchAsync(companyId);
        }
        catch (SubscriptionLimitException ex)
        {
            return StatusCode(402, new { code = "BRANCH_LIMIT_REACHED", message = ex.Message });
        }

        var branch = new Branch
        {
            BusinessId = _businessContext.CurrentBusinessId,
            Name = req.Name.Trim(),
            Code = req.Code.Trim().ToUpper(),
            Address = req.Address?.Trim(),
            Phone = req.Phone?.Trim(),
            IsActive = true,
            IsDefault = false // only the seeded Main Branch is ever the default
        };
        _db.Branches.Add(branch);
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "CREATE", "Branch", branch.Id, null, new { branch.Name, branch.Code });
        return CreatedAtAction(nameof(GetAll), new { }, new
        {
            branch.Id, branch.Name, branch.Code, branch.Address, branch.Phone, branch.IsActive, branch.IsDefault
        });
    }

    [HttpPatch("{id:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BranchRequest req)
    {
        var branch = await _db.Branches.FindAsync(id);
        if (branch is null) return NotFound();

        var before = new { branch.Name, branch.Code, branch.Address, branch.Phone };
        branch.Name = req.Name.Trim();
        branch.Code = req.Code.Trim().ToUpper();
        branch.Address = req.Address?.Trim();
        branch.Phone = req.Phone?.Trim();
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "Branch", id, before, new { branch.Name, branch.Code });
        return NoContent();
    }

    [HttpPatch("{id:guid}/toggle-active")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var branch = await _db.Branches.FindAsync(id);
        if (branch is null) return NotFound();

        if (branch.IsActive)
        {
            if (branch.IsDefault)
                return BadRequest(new { message = "The default branch cannot be deactivated." });

            var otherActiveCount = await _db.Branches
                .CountAsync(b => b.Id != id && b.IsActive);
            if (otherActiveCount == 0)
                return BadRequest(new { message = "Cannot deactivate the last active branch." });
        }

        branch.IsActive = !branch.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { branch.IsActive });
    }
}

public record BranchRequest(
    string Name,
    string Code,
    string? Address,
    string? Phone);
