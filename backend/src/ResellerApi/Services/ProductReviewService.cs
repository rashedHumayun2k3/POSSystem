using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ProductReviewService : IProductReviewService
{
    private const int MaxImagesPerReview = 5;

    private readonly AppDbContext _db;

    public ProductReviewService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ProductReviewListDto> GetReviewsAsync(Guid productId)
    {
        // Marketplace-mode requests carry no tenant business context, so this — like
        // ClientPageCatalogService — is one of the deliberate cross-tenant reads.
        var reviews = await _db.ProductReviews
            .IgnoreQueryFilters()
            .Include(r => r.ReviewerAccount)
            .Include(r => r.Images)
            .Include(r => r.Replies)
            .Where(r => r.ProductId == productId && r.DeletedAt == null)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var summary = new ProductReviewSummaryDto(
            reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : 0,
            reviews.Count);

        var dtos = reviews.Select(r => new ProductReviewDto(
            r.Id, r.Rating, r.Body, r.ReviewerAccount.Name, r.ReviewerAccount.PhotoUrl, r.CreatedAt,
            r.Images.Select(i => new ReviewImageDto(i.Id, i.ImageUrl)).ToList(),
            r.Replies.Where(rep => rep.DeletedAt == null).OrderByDescending(rep => rep.CreatedAt).Select(rep => new ReviewReplyDto(rep.Body, rep.CreatedAt)).FirstOrDefault()
        )).ToList();

        return new ProductReviewListDto(summary, dtos);
    }

    public async Task SubmitReviewAsync(Guid productId, Guid reviewerAccountId, SubmitReviewRequest request)
    {
        if (request.Rating is < 1 or > 5)
            throw new ArgumentException("Rating must be between 1 and 5.");
        if (string.IsNullOrWhiteSpace(request.Body))
            throw new ArgumentException("Review text is required.");

        var product = await _db.Products.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == productId && p.DeletedAt == null)
            ?? throw new KeyNotFoundException("Product not found.");

        var phone = PhoneNormalizer.Normalize(request.Phone);

        var hasVerifiedPurchase = await _db.Orders.IgnoreQueryFilters()
            .AnyAsync(o => o.BusinessId == product.BusinessId && o.CustomerPhone == phone &&
                           o.OrderStatus != "CANCELLED" &&
                           o.Items.Any(i => i.Variant.ProductId == productId));
        if (!hasVerifiedPurchase)
            throw new InvalidOperationException("We couldn't find an order for this product with that phone number.");

        var alreadyReviewed = await _db.ProductReviews.IgnoreQueryFilters()
            .AnyAsync(r => r.ProductId == productId && r.ReviewerAccountId == reviewerAccountId && r.DeletedAt == null);
        if (alreadyReviewed)
            throw new InvalidOperationException("You've already reviewed this product.");

        var review = new ProductReview
        {
            BusinessId = product.BusinessId,
            ProductId = productId,
            ReviewerAccountId = reviewerAccountId,
            Rating = request.Rating,
            Body = request.Body.Trim(),
            VerifiedPhone = phone
        };

        foreach (var url in (request.ImageUrls ?? []).Take(MaxImagesPerReview))
            review.Images.Add(new ProductReviewImage { ImageUrl = url });

        _db.ProductReviews.Add(review);
        await _db.SaveChangesAsync();
    }

    // Review-photo upload now lives on the standalone ResellerApi.MediaService app.

    public async Task<List<AdminProductReviewDto>> GetReviewsForStaffAsync(Guid businessId, Guid productId)
    {
        var reviews = await _db.ProductReviews
            .IgnoreQueryFilters()
            .Include(r => r.ReviewerAccount)
            .Include(r => r.Images)
            .Include(r => r.Replies)
            .Where(r => r.BusinessId == businessId && r.ProductId == productId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return reviews.Select(r => new AdminProductReviewDto(
            r.Id, r.Rating, r.Body, r.ReviewerAccount.Name, r.ReviewerAccount.PhotoUrl, r.CreatedAt,
            r.DeletedAt != null,
            r.Images.Select(i => new ReviewImageDto(i.Id, i.ImageUrl)).ToList(),
            r.Replies.Where(rep => rep.DeletedAt == null).OrderByDescending(rep => rep.CreatedAt).Select(rep => new ReviewReplyDto(rep.Body, rep.CreatedAt)).FirstOrDefault()
        )).ToList();
    }

    public async Task ReplyAsync(Guid businessId, Guid reviewId, Guid userId, ReplyToReviewRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Body))
            throw new ArgumentException("Reply text is required.");

        var review = await _db.ProductReviews.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Id == reviewId && r.BusinessId == businessId)
            ?? throw new KeyNotFoundException("Review not found.");

        _db.ProductReviewReplies.Add(new ProductReviewReply
        {
            ReviewId = review.Id,
            RepliedByUserId = userId,
            Body = request.Body.Trim()
        });
        await _db.SaveChangesAsync();
    }

    // Soft-deletes ALL of the review's replies, not just the latest — deleting must mean "no
    // reply now", not "fall back to an older edit". Replies are one-to-many per review (each
    // edit via ReplyAsync adds a new row rather than mutating in place) but only ever ONE shows
    // at a time, so leaving earlier rows live would make a delete silently resurrect history.
    // Never a hard delete, same convention as everything else in this app.
    public async Task DeleteReplyAsync(Guid businessId, Guid reviewId)
    {
        var review = await _db.ProductReviews.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Id == reviewId && r.BusinessId == businessId)
            ?? throw new KeyNotFoundException("Review not found.");

        var activeReplies = await _db.ProductReviewReplies
            .Where(rep => rep.ReviewId == review.Id && rep.DeletedAt == null)
            .ToListAsync();
        if (activeReplies.Count == 0)
            throw new KeyNotFoundException("No reply to delete.");

        var now = DateTime.UtcNow;
        foreach (var reply in activeReplies)
            reply.DeletedAt = now;
        await _db.SaveChangesAsync();
    }

    public async Task SetHiddenAsync(Guid businessId, Guid reviewId, bool hidden)
    {
        var review = await _db.ProductReviews.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Id == reviewId && r.BusinessId == businessId)
            ?? throw new KeyNotFoundException("Review not found.");

        review.DeletedAt = hidden ? DateTime.UtcNow : null;
        await _db.SaveChangesAsync();
    }
}
