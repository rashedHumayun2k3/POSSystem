namespace ResellerApi.DTOs.ClientPage;

public record ReviewImageDto(Guid Id, string ImageUrl);

public record ReviewReplyDto(string Body, DateTime CreatedAt);

public record ProductReviewDto(
    Guid Id,
    int Rating,
    string Body,
    string ReviewerName,
    string? ReviewerPhotoUrl,
    DateTime CreatedAt,
    List<ReviewImageDto> Images,
    ReviewReplyDto? Reply
);

public record ProductReviewSummaryDto(double AverageRating, int Count);

public record ProductReviewListDto(ProductReviewSummaryDto Summary, List<ProductReviewDto> Reviews);

public record SubmitReviewRequest(int Rating, string Body, string Phone, List<string>? ImageUrls);

// Staff-side (owner/manager) view — same review shape plus hidden reviews and no purchase-phone
// leakage into the public DTO above.
public record AdminProductReviewDto(
    Guid Id,
    int Rating,
    string Body,
    string ReviewerName,
    string? ReviewerPhotoUrl,
    DateTime CreatedAt,
    bool IsHidden,
    List<ReviewImageDto> Images,
    ReviewReplyDto? Reply
);

public record ReplyToReviewRequest(string Body);
