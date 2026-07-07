using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class EmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(IConfiguration config, ILogger<EmailSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendVerificationCodeAsync(string email, string code)
    {
        var host = _config["Email:SmtpHost"];
        var fromAddress = _config["Email:FromAddress"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress))
        {
            _logger.LogWarning(
                "Email:SmtpHost / Email:FromAddress not configured — verification code for {Email} was NOT sent. Code: {Code}",
                email, code);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_config["Email:FromName"] ?? "Account Verification", fromAddress));
        message.To.Add(MailboxAddress.Parse(email));
        message.Subject = "Your verification code";
        message.Body = new TextPart("plain")
        {
            Text = $"Your verification code is: {code}\n\nThis code expires in 10 minutes."
        };

        using var client = new SmtpClient();
        var port = int.Parse(_config["Email:SmtpPort"] ?? "587");
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);

        var user = _config["Email:SmtpUser"];
        var password = _config["Email:SmtpPassword"];
        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, password);

        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
