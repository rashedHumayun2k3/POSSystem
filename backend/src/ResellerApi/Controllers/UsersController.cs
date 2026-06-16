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

    public UsersController(AppDbContext db, ICurrentUserService currentUser,
        IActivityLogService activityLog, IBusinessContext businessContext)
    {
        _db = db;
        _currentUser = currentUser;
        _activityLog = activityLog;
        _businessContext = businessContext;
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

        var phone = request.Phone.Trim().TrimStart('+').TrimStart('8', '8');
        if (await _db.Users.AnyAsync(u => u.Phone == request.Phone))
            return Conflict(new { code = "PHONE_TAKEN", message = "This phone number is already registered." });

        var user = new Entities.User
        {
            CompanyId = Guid.Parse(User.FindFirst("company_id")!.Value),
            Name = request.Name,
            Phone = request.Phone,
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

public record CreateUserRequest(string Name, string Phone, string Password, string Role, decimal MonthlySalary);
public record UpdateUserRequest(string Name, string Role, decimal MonthlySalary);
public record ResetPasswordRequest(string NewPassword);
