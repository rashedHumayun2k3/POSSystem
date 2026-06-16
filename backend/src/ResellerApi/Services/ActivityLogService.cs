using System.Text.Json;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ActivityLogService : IActivityLogService
{
    private readonly AppDbContext _db;

    public ActivityLogService(AppDbContext db) => _db = db;

    public async Task LogAsync(
        Guid businessId,
        Guid userId,
        string action,
        string entityType,
        Guid? entityId = null,
        object? before = null,
        object? after = null)
    {
        _db.ActivityLogs.Add(new ActivityLog
        {
            BusinessId = businessId,
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            BeforeJson = before is null ? null : JsonSerializer.Serialize(before),
            AfterJson = after is null ? null : JsonSerializer.Serialize(after)
        });
        await _db.SaveChangesAsync();
    }
}
