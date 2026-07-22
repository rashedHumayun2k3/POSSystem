using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ProductReview : BusinessScopedEntity
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public Guid ReviewerAccountId { get; set; }
    public ClientPageCustomerAccount ReviewerAccount { get; set; } = null!;

    public int Rating { get; set; } // 1-5
    public string Body { get; set; } = null!;

    // The order phone number that verified this review's purchase — kept for audit, not shown publicly.
    public string VerifiedPhone { get; set; } = null!;

    public ICollection<ProductReviewImage> Images { get; set; } = new List<ProductReviewImage>();
    public ICollection<ProductReviewReply> Replies { get; set; } = new List<ProductReviewReply>();
}
