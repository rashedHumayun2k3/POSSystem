using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Feedback;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class FeedbackService : IFeedbackService
{
    private readonly AppDbContext _db;

    public FeedbackService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<FeedbackDto> CreateAsync(Guid businessId, Guid userId, CreateFeedbackRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Subject))
            throw new ArgumentException("Subject is required.");
        if (string.IsNullOrWhiteSpace(request.Details))
            throw new ArgumentException("Details are required.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
            ?? throw new KeyNotFoundException("User not found.");

        var feedback = new Feedback
        {
            BusinessId = businessId,
            SubmittedByUserId = userId,
            Subject = request.Subject.Trim(),
            Details = request.Details.Trim(),
            ImageUrl = request.ImageUrl
        };
        _db.Feedbacks.Add(feedback);
        await _db.SaveChangesAsync();

        return new FeedbackDto(feedback.Id, feedback.Subject, feedback.Details, feedback.ImageUrl,
            feedback.CreatedAt, user.Name, null);
    }

    public async Task<List<FeedbackDto>> ListForBusinessAsync(Guid businessId)
    {
        var rows = await _db.Feedbacks
            .IgnoreQueryFilters()
            .Include(f => f.SubmittedByUser)
            .Include(f => f.Replies)
            .Where(f => f.BusinessId == businessId && f.DeletedAt == null)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();

        return rows.Select(f => new FeedbackDto(
            f.Id, f.Subject, f.Details, f.ImageUrl, f.CreatedAt, f.SubmittedByUser.Name,
            LatestReply(f)
        )).ToList();
    }

    public async Task<List<AdminFeedbackDto>> ListAllAsync(string? search)
    {
        var query = _db.Feedbacks
            .IgnoreQueryFilters()
            .Include(f => f.SubmittedByUser)
            .Include(f => f.Business)
            .Include(f => f.Replies)
            .Where(f => f.DeletedAt == null)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(f => f.Subject.Contains(search) || f.Business.Name.Contains(search));

        var rows = await query.OrderByDescending(f => f.CreatedAt).ToListAsync();

        return rows.Select(f => new AdminFeedbackDto(
            f.Id, f.Subject, f.Details, f.ImageUrl, f.CreatedAt, f.SubmittedByUser.Name, f.Business.Name,
            LatestReply(f)
        )).ToList();
    }

    public async Task ReplyAsync(Guid feedbackId, string repliedByUsername, ReplyToFeedbackRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Body))
            throw new ArgumentException("Reply text is required.");

        var feedback = await _db.Feedbacks.IgnoreQueryFilters()
            .FirstOrDefaultAsync(f => f.Id == feedbackId && f.DeletedAt == null)
            ?? throw new KeyNotFoundException("Feedback not found.");

        _db.FeedbackReplies.Add(new FeedbackReply
        {
            FeedbackId = feedback.Id,
            RepliedByUsername = repliedByUsername,
            Body = request.Body.Trim()
        });
        await _db.SaveChangesAsync();
    }

    // "Has a live reply" IS the status — no boolean/enum column, same convention as
    // ProductReview/ProductReviewReply. Null ⇒ unanswered (red), non-null ⇒ answered (blue).
    private static FeedbackReplyDto? LatestReply(Feedback f) =>
        f.Replies.Where(r => r.DeletedAt == null)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new FeedbackReplyDto(r.Body, r.CreatedAt, r.RepliedByUsername))
            .FirstOrDefault();
}
