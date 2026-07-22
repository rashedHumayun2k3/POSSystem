using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ProductReviewReply : BaseEntity
{
    public Guid ReviewId { get; set; }
    public ProductReview Review { get; set; } = null!;

    public Guid RepliedByUserId { get; set; }
    public User RepliedByUser { get; set; } = null!;

    public string Body { get; set; } = null!;
}
