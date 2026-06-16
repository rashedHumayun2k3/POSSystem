using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ActivityLog : BaseEntity
{
    public Guid BusinessId { get; set; }
    public Guid UserId { get; set; }
    public string Action { get; set; } = null!; // CREATE, UPDATE, DELETE, STATUS_CHANGE, LOGIN
    public string EntityType { get; set; } = null!;
    public Guid? EntityId { get; set; }
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }

    public Business Business { get; set; } = null!;
    public User User { get; set; } = null!;
}
