using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

/// <summary>
/// Talks to bKash's Tokenized Checkout API (grant token -> create payment -> execute payment).
/// Config-gated the same way EmailSender is gated on SMTP config: until Bkash:AppKey/Username
/// are set, checkout simply refuses to start with a clear error instead of faking success.
/// </summary>
public class BkashPaymentService : IBkashPaymentService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<BkashPaymentService> _logger;

    public BkashPaymentService(HttpClient http, IConfiguration config, ILogger<BkashPaymentService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
        var baseUrl = _config["Bkash:BaseUrl"];
        if (!string.IsNullOrWhiteSpace(baseUrl))
            _http.BaseAddress = new Uri(baseUrl);
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_config["Bkash:AppKey"]) &&
        !string.IsNullOrWhiteSpace(_config["Bkash:Username"]);

    public async Task<BkashCheckoutResult> CreatePaymentAsync(decimal amount, string invoiceNumber)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("bKash payments are not configured yet. Please contact support.");

        var idToken = await GrantTokenAsync();

        var req = new HttpRequestMessage(HttpMethod.Post, "/tokenized/checkout/create");
        req.Headers.Add("Authorization", idToken);
        req.Headers.Add("X-APP-Key", _config["Bkash:AppKey"]);
        req.Content = JsonContent.Create(new
        {
            mode = "0011",
            payerReference = invoiceNumber,
            callbackURL = _config["Bkash:CallbackUrl"],
            amount = amount.ToString("0.00"),
            currency = "BDT",
            intent = "sale",
            merchantInvoiceNumber = invoiceNumber
        });

        var res = await _http.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<BkashCreatePaymentResponse>()
            ?? throw new InvalidOperationException("bKash create-payment returned an empty response.");

        if (string.IsNullOrWhiteSpace(body.paymentID) || string.IsNullOrWhiteSpace(body.bkashURL))
        {
            _logger.LogWarning("bKash create-payment failed: {Message}", body.statusMessage);
            throw new InvalidOperationException(body.statusMessage ?? "bKash could not start the payment.");
        }

        return new BkashCheckoutResult(body.paymentID, body.bkashURL);
    }

    public async Task<BkashExecuteResult> ExecutePaymentAsync(string paymentId)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("bKash payments are not configured yet. Please contact support.");

        var idToken = await GrantTokenAsync();

        var req = new HttpRequestMessage(HttpMethod.Post, "/tokenized/checkout/execute");
        req.Headers.Add("Authorization", idToken);
        req.Headers.Add("X-APP-Key", _config["Bkash:AppKey"]);
        req.Content = JsonContent.Create(new { paymentID = paymentId });

        var res = await _http.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<BkashExecutePaymentResponse>()
            ?? throw new InvalidOperationException("bKash execute-payment returned an empty response.");

        var success = body.transactionStatus == "Completed";
        if (!success)
            _logger.LogWarning("bKash execute-payment did not complete: {Message}", body.statusMessage);

        return new BkashExecuteResult(success, body.trxID);
    }

    private async Task<string> GrantTokenAsync()
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/tokenized/checkout/token/grant");
        req.Headers.Add("username", _config["Bkash:Username"]);
        req.Headers.Add("password", _config["Bkash:Password"]);
        req.Content = JsonContent.Create(new
        {
            app_key = _config["Bkash:AppKey"],
            app_secret = _config["Bkash:AppSecret"]
        });

        var res = await _http.SendAsync(req);
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<BkashTokenResponse>()
            ?? throw new InvalidOperationException("bKash token grant returned an empty response.");

        if (string.IsNullOrWhiteSpace(body.id_token))
            throw new InvalidOperationException(body.msg ?? "bKash token grant failed.");

        return body.id_token;
    }

    private record BkashTokenResponse(string? id_token, string? refresh_token, string? statusCode, string? msg);
    private record BkashCreatePaymentResponse(string? paymentID, string? bkashURL, string? statusCode, string? statusMessage);
    private record BkashExecutePaymentResponse(string? paymentID, string? trxID, string? transactionStatus, string? statusCode, string? statusMessage);
}
