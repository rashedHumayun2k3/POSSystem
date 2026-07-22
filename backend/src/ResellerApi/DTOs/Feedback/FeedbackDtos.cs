namespace ResellerApi.DTOs.Feedback;

public record FeedbackReplyDto(string Body, DateTime CreatedAt, string RepliedByUsername);

public record FeedbackDto(
    Guid Id,
    string Subject,
    string Details,
    string? ImageUrl,
    DateTime CreatedAt,
    string SubmittedByName,
    FeedbackReplyDto? Reply
);

// Platform-admin cross-tenant view — same shape plus which business it came from.
public record AdminFeedbackDto(
    Guid Id,
    string Subject,
    string Details,
    string? ImageUrl,
    DateTime CreatedAt,
    string SubmittedByName,
    string BusinessName,
    FeedbackReplyDto? Reply
);

public record CreateFeedbackRequest(string Subject, string Details, string? ImageUrl);

public record ReplyToFeedbackRequest(string Body);
