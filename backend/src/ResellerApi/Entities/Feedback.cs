using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Feedback : BusinessScopedEntity
{
    public Guid SubmittedByUserId { get; set; }
    public User SubmittedByUser { get; set; } = null!;

    public string Subject { get; set; } = null!;
    public string Details { get; set; } = null!;
    public string? ImageUrl { get; set; }

    public ICollection<FeedbackReply> Replies { get; set; } = new List<FeedbackReply>();
}
