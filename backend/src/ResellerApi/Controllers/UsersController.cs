using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IActivityLogService _activityLog;
    private readonly IBusinessContext _businessContext;
    private readonly ISubscriptionService _subscriptions;

    public UsersController(AppDbContext db, ICurrentUserService currentUser,
        IActivityLogService activityLog, IBusinessContext businessContext, ISubscriptionService subscriptions)
    {
        _db = db;
        _currentUser = currentUser;
        _activityLog = activityLog;
        _businessContext = businessContext;
        _subscriptions = subscriptions;
    }

    [HttpGet]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> GetAll()
    {
        var users = await _db.BusinessUsers
            .AsNoTracking()
            .Where(bu => bu.BusinessId == _businessContext.CurrentBusinessId)
            .Select(bu => new
            {
                bu.User.Id,
                bu.User.Name,
                bu.User.Phone,
                bu.User.Role,
                bu.User.IsActive,
                MonthlySalary = bu.User.MonthlySalary
            })
            .ToListAsync();
        return Ok(users);
    }

    [HttpPost]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        if (!Roles.All.Contains(request.Role))
            return BadRequest(new { message = $"Invalid role. Allowed: {string.Join(", ", Roles.All)}." });

        var phone = PhoneNormalizer.Normalize(request.Phone);
        if (await _db.Users.AnyAsync(u => u.Phone == phone))
            return Conflict(new { code = "PHONE_TAKEN", message = "This phone number is already registered." });

        var companyId = Guid.Parse(User.FindFirst("company_id")!.Value);
        try
        {
            await _subscriptions.EnsureCanAddStaffAsync(companyId);
        }
        catch (SubscriptionLimitException ex)
        {
            return StatusCode(402, new { code = "SEAT_LIMIT_REACHED", message = ex.Message });
        }

        var user = new Entities.User
        {
            CompanyId = companyId,
            Name = request.Name,
            Phone = phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            MonthlySalary = request.MonthlySalary,
            IsActive = true
        };
        _db.Users.Add(user);

        _db.BusinessUsers.Add(new Entities.BusinessUser
        {
            BusinessId = _businessContext.CurrentBusinessId,
            UserId = user.Id
        });

        // STAFF/WAREHOUSE need an explicit UserBranch row to pass the branch-access check
        // (OWNER/MANAGER can select any branch in the business without one — see
        // BusinessContextMiddleware). Default to the sole active branch when the caller
        // didn't specify one and only one exists.
        if (request.Role is Roles.Staff or Roles.Warehouse)
        {
            var branchIds = request.BranchIds ?? [];
            if (branchIds.Length == 0)
            {
                var activeBranches = await _db.Branches
                    .Where(b => b.IsActive)
                    .Select(b => b.Id)
                    .ToListAsync();
                if (activeBranches.Count == 1)
                    branchIds = [activeBranches[0]];
            }

            foreach (var branchId in branchIds)
            {
                _db.UserBranches.Add(new Entities.UserBranch
                {
                    UserId = user.Id,
                    BranchId = branchId,
                    IsDefault = branchId == branchIds[0]
                });
            }
        }

        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "CREATE", "User", user.Id, null, new { user.Id, user.Name, user.Phone, user.Role });

        return CreatedAtAction(nameof(GetAll), new { }, new { user.Id, user.Name, user.Phone, user.Role });
    }

    [HttpPatch("{id:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        if (!Roles.All.Contains(request.Role))
            return BadRequest(new { message = $"Invalid role. Allowed: {string.Join(", ", Roles.All)}." });

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();
        var before = new { user.Name, user.Role, user.MonthlySalary };
        user.Name = request.Name.Trim();
        user.Role = request.Role;
        user.MonthlySalary = request.MonthlySalary;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "User", id, before, new { user.Name, user.Role, user.MonthlySalary });
        return NoContent();
    }

    [HttpPatch("{id:guid}/deactivate")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();
        user.IsActive = false;
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "User", id, new { user.IsActive }, new { IsActive = false });
        return NoContent();
    }

    // Self-service only — any authenticated role can set their own profile photo (no OWNER
    // restriction, unlike the rest of this controller which manages other staff members).
    [HttpPatch("me/photo")]
    public async Task<IActionResult> UpdateMyPhoto([FromBody] UpdateMyPhotoRequest request)
    {
        var user = await _db.Users.FindAsync(_currentUser.UserId);
        if (user is null) return NotFound();

        user.PhotoUrl = string.IsNullOrWhiteSpace(request.PhotoUrl) ? null : request.PhotoUrl.Trim();
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "User", user.Id, null, new { action = "photo_updated" });

        return Ok(new { user.PhotoUrl });
    }

    [HttpPatch("{id:guid}/reset-password")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        var user = await _db.Users.FindAsync(id);
        if (user is null) return NotFound();

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();
        await _activityLog.LogAsync(_businessContext.CurrentBusinessId, _currentUser.UserId,
            "UPDATE", "User", id, null, new { action = "password_reset" });
        return NoContent();
    }
}

public record CreateUserRequest(string Name, string Phone, string Password, string Role, decimal MonthlySalary, Guid[]? BranchIds = null);
public record UpdateUserRequest(string Name, string Role, decimal MonthlySalary);
public record ResetPasswordRequest(string NewPassword);
public record UpdateMyPhotoRequest(string? PhotoUrl);
