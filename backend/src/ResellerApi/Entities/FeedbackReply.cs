using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class FeedbackReply : BaseEntity
{
    public Guid FeedbackId { get; set; }
    public Feedback Feedback { get; set; } = null!;

    // No FK to a User row — replies come from a PlatformAdminAccount, which (per its own
    // documented convention in Infrastructure/Roles.cs) is never assignable to a User row.
    public string RepliedByUsername { get; set; } = null!;

    public string Body { get; set; } = null!;
}
