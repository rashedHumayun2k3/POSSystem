namespace ResellerApi.Services.Interfaces;

public interface IEmailSender
{
    Task SendVerificationCodeAsync(string email, string code);
}
