namespace ResellerApi.Services;

public static class OrderPaymentReference
{
    public static string? Normalize(string method, string? reference)
    {
        if (method is not ("BKASH" or "NAGAD" or "CARD")) return null;
        var value = reference?.Trim();
        if (string.IsNullOrEmpty(value)) return null;
        if (value.Length > 100)
            throw new InvalidOperationException("Payment reference cannot exceed 100 characters.");
        return value;
    }
}
