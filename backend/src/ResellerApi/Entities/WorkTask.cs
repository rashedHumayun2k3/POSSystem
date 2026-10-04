using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class WorkTask : BusinessScopedEntity
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public Guid CreatorId { get; set; }
    public User Creator { get; set; } = null!;
    public Guid AssigneeId { get; set; }
    public User Assignee { get; set; } = null!;
    public DateTime? DueAt { get; set; }
    public string Priority { get; set; } = "NORMAL";
    public string Status { get; set; } = "TODO";
    public Guid? CompletedById { get; set; }
    public User? CompletedBy { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class TaskEntry : BusinessScopedEntity
{
    public Guid TaskId { get; set; }
    public WorkTask Task { get; set; } = null!;
    public Guid ActorId { get; set; }
    public User Actor { get; set; } = null!;
    public string Kind { get; set; } = "";
    public string Message { get; set; } = "";
}

public class TaskNotification : BusinessScopedEntity
{
    public Guid TaskId { get; set; }
    public WorkTask Task { get; set; } = null!;
    public Guid RecipientId { get; set; }
    public User Recipient { get; set; } = null!;
    public string Message { get; set; } = "";
    public DateTime? ReadAt { get; set; }
}
