using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/activity-logs")]
[Authorize(Roles = "OWNER")]
public class ActivityLogController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _businessContext;

    public ActivityLogController(AppDbContext db, IBusinessContext businessContext)
    {
        _db = db;
        _businessContext = businessContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? userId,
        [FromQuery] string? entityType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.ActivityLogs
            .AsNoTracking()
            .Where(l => l.BusinessId == _businessContext.CurrentBusinessId);

        if (userId.HasValue) query = query.Where(l => l.UserId == userId.Value);
        if (!string.IsNullOrEmpty(entityType)) query = query.Where(l => l.EntityType == entityType);
        if (from.HasValue) query = query.Where(l => l.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(l => l.CreatedAt <= to.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                l.Id,
                l.UserId,
                UserName = l.User.Name,
                l.Action,
                l.EntityType,
                l.EntityId,
                l.BeforeJson,
                l.AfterJson,
                l.CreatedAt
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, items });
    }
}
