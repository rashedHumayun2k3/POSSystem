namespace ResellerApi.Services.Interfaces;

public interface IEmailSender
{
    Task SendVerificationCodeAsync(string email, string code);
    Task SendPasswordResetCodeAsync(string email, string code);
}
