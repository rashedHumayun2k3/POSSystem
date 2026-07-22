using ResellerApi.DTOs.ClientPage;

namespace ResellerApi.Services.Interfaces;

public interface IProductReviewService
{
    // Public (ClientPage) side.
    Task<ProductReviewListDto> GetReviewsAsync(Guid productId);
    Task SubmitReviewAsync(Guid productId, Guid reviewerAccountId, SubmitReviewRequest request);

    // Staff (owner/manager) side — operates within the caller's own business.
    Task<List<AdminProductReviewDto>> GetReviewsForStaffAsync(Guid businessId, Guid productId);
    Task ReplyAsync(Guid businessId, Guid reviewId, Guid userId, ReplyToReviewRequest request);
    Task DeleteReplyAsync(Guid businessId, Guid reviewId);
    Task SetHiddenAsync(Guid businessId, Guid reviewId, bool hidden);
}
