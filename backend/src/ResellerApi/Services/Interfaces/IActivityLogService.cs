namespace ResellerApi.Services.Interfaces;

public interface IActivityLogService
{
    Task LogAsync(
        Guid businessId,
        Guid userId,
        string action,
        string entityType,
        Guid? entityId = null,
        object? before = null,
        object? after = null);
}
