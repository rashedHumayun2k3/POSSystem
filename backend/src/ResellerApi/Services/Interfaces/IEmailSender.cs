namespace ResellerApi.Services.Interfaces;

public interface IEmailSender
{
    Task SendVerificationCodeAsync(string email, string code, string? lang = null);
    Task SendPasswordResetCodeAsync(string email, string code, string? lang = null);
    Task SendEmailWithAttachmentAsync(string email, string subject, string htmlBody, byte[] attachmentBytes, string attachmentFileName, string attachmentContentType);
}
