using ResellerApi.DTOs.Feedback;

namespace ResellerApi.Services.Interfaces;

public interface IFeedbackService
{
    Task<FeedbackDto> CreateAsync(Guid businessId, Guid userId, CreateFeedbackRequest request);
    Task<List<FeedbackDto>> ListForBusinessAsync(Guid businessId);
    Task<List<AdminFeedbackDto>> ListAllAsync(string? search);
    Task ReplyAsync(Guid feedbackId, string repliedByUsername, ReplyToFeedbackRequest request);
}
