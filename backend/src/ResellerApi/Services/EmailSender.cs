using MailKit.Net.Smtp;
using MailKit.Security;
using System.Net.Security;
using MimeKit;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class EmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailSender> _logger;
    private readonly IWebHostEnvironment _environment;

    public EmailSender(IConfiguration config, ILogger<EmailSender> logger, IWebHostEnvironment environment)
    {
        _config = config;
        _logger = logger;
        _environment = environment;
    }

    public async Task SendVerificationCodeAsync(string email, string code, string? lang = null)
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
        var reportLang = string.Equals(lang, "bn", StringComparison.OrdinalIgnoreCase) ? "bn" : "en";
        message.Subject = reportLang == "bn"
            ? "LavLokshan ভেরিফিকেশন কোড"
            : "Your Verification Code From LavLokshan";
        var html = RenderSignupVerificationTemplate(reportLang, code);
        var body = new BodyBuilder
        {
            TextBody =
                reportLang == "bn"
                    ? $"আসসালামু আলাইকুম,\n\nআপনার LavLokshan অ্যাকাউন্ট ভেরিফাই করার জন্য একটি অনুরোধ এসেছে।\n\nআপনার ভেরিফিকেশন কোড:\n\n{code}\n\nএই কোডটি ১০ মিনিট পর্যন্ত ব্যবহার করা যাবে। অ্যাকাউন্টের নিরাপত্তার জন্য কোডটি কাউকে জানাবেন না।\n\nআপনি যদি এই কোড না চেয়ে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করতে পারেন।\n\nধন্যবাদ,\nLavLokshan টিম"
                    : $"Hello,\n\nWe received a request to verify your account.\n\nYour verification code is:\n\n{code}\n\nThis code will expire in 10 minutes. Please do not share this code with anyone for your account security.\n\nIf you did not request this verification code, you can safely ignore this email.\n\nThank you,\nLavLokshan Team",
            HtmlBody = html
        };
        message.Body = body.ToMessageBody();

        using var client = CreateSmtpClient();
        var port = int.Parse(_config["Email:SmtpPort"] ?? "587");
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);

        var user = _config["Email:SmtpUser"];
        var password = _config["Email:SmtpPassword"];
        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, password);

        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }

    public async Task SendPasswordResetCodeAsync(string email, string code, string? lang = null)
    {
        var host = _config["Email:SmtpHost"];
        var fromAddress = _config["Email:FromAddress"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress))
        {
            _logger.LogWarning(
                "Email:SmtpHost / Email:FromAddress not configured — password reset code for {Email} was NOT sent. Code: {Code}",
                email, code);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_config["Email:FromName"] ?? "Account Verification", fromAddress));
        message.To.Add(MailboxAddress.Parse(email));
        var reportLang = string.Equals(lang, "bn", StringComparison.OrdinalIgnoreCase) ? "bn" : "en";
        message.Subject = reportLang == "bn"
            ? "LavLokshan পাসওয়ার্ড রিসেট কোড"
            : "Reset Your LavLokshan Password";
        var html = RenderPasswordResetTemplate(reportLang, code);
        var body = new BodyBuilder
        {
            TextBody =
                reportLang == "bn"
                    ? $"আসসালামু আলাইকুম,\n\nআপনার LavLokshan অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার জন্য একটি অনুরোধ এসেছে।\n\nআপনার পাসওয়ার্ড রিসেট কোড:\n\n{code}\n\nএই কোডটি ১০ মিনিট পর্যন্ত ব্যবহার করা যাবে। অ্যাকাউন্টের নিরাপত্তার জন্য কোডটি কাউকে জানাবেন না।\n\nআপনি যদি পাসওয়ার্ড রিসেটের অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করতে পারেন। আপনার পাসওয়ার্ড পরিবর্তন হবে না।\n\nধন্যবাদ,\nLavLokshan টিম"
                    : $"Hello,\n\nWe received a request to reset your LavLokshan account password.\n\nYour password reset code is:\n\n{code}\n\nThis code will expire in 10 minutes. Please do not share this code with anyone for your account security.\n\nIf you did not request a password reset, you can safely ignore this email. Your password will not be changed.\n\nThank you,\nLavLokshan Team",
            HtmlBody = html
        };
        message.Body = body.ToMessageBody();

        using var client = CreateSmtpClient();
        var port = int.Parse(_config["Email:SmtpPort"] ?? "587");
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);

        var user = _config["Email:SmtpUser"];
        var password = _config["Email:SmtpPassword"];
        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, password);

        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }

    private static string RenderPasswordResetTemplate(string lang, string code)
    {
        var fileName = lang == "bn" ? "password-reset.bn.html" : "password-reset.en.html";
        var path = Path.Combine(AppContext.BaseDirectory, "Templates", "Emails", fileName);
        var html = File.ReadAllText(path);
        return html.Replace("{{code}}", code);
    }

    private static string RenderSignupVerificationTemplate(string lang, string code)
    {
        var fileName = lang == "bn" ? "signup-verification.bn.html" : "signup-verification.en.html";
        var path = Path.Combine(AppContext.BaseDirectory, "Templates", "Emails", fileName);
        var html = File.ReadAllText(path);
        return html.Replace("{{code}}", code);
    }

    public async Task SendEmailWithAttachmentAsync(
        string email,
        string subject,
        string htmlBody,
        byte[] attachmentBytes,
        string attachmentFileName,
        string attachmentContentType)
    {
        var host = _config["Email:SmtpHost"];
        var fromAddress = _config["Email:FromAddress"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress))
        {
            _logger.LogWarning(
                "Email:SmtpHost / Email:FromAddress not configured — report email for {Email} was NOT sent. Subject: {Subject}",
                email, subject);
            throw new InvalidOperationException("Email SMTP is not configured, so the report could not be sent.");
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_config["Email:FromName"] ?? "Reseller System", fromAddress));
        message.To.Add(MailboxAddress.Parse(email));
        message.Subject = subject;

        var body = new BodyBuilder { HtmlBody = htmlBody };
        body.Attachments.Add(attachmentFileName, attachmentBytes, ContentType.Parse(attachmentContentType));
        message.Body = body.ToMessageBody();

        using var client = CreateSmtpClient();
        var port = int.Parse(_config["Email:SmtpPort"] ?? "587");
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);

        var user = _config["Email:SmtpUser"];
        var password = _config["Email:SmtpPassword"];
        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, password);

        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }

    private SmtpClient CreateSmtpClient()
    {
        var client = new SmtpClient();

        if (_environment.IsDevelopment())
        {
            client.ServerCertificateValidationCallback = (_, _, _, errors) =>
            {
                if (errors == SslPolicyErrors.None)
                    return true;

                if ((errors & ~SslPolicyErrors.RemoteCertificateChainErrors) != 0)
                    return false;

                _logger.LogWarning(
                    "Ignoring SMTP certificate chain validation failure in Development. Errors: {Errors}",
                    errors);
                return true;
            };
        }

        return client;
    }
}
