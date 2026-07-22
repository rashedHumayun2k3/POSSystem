using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ProductReviewImage : BaseEntity
{
    public Guid ReviewId { get; set; }
    public ProductReview Review { get; set; } = null!;
    public string ImageUrl { get; set; } = null!;
}
