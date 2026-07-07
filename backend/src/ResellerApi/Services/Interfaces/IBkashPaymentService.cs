namespace ResellerApi.Services.Interfaces;

public record BkashCheckoutResult(string PaymentId, string BkashRedirectUrl);
public record BkashExecuteResult(bool Success, string? TrxId);

public interface IBkashPaymentService
{
    bool IsConfigured { get; }
    Task<BkashCheckoutResult> CreatePaymentAsync(decimal amount, string invoiceNumber);
    Task<BkashExecuteResult> ExecutePaymentAsync(string paymentId);
}
