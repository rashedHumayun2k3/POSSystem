namespace ResellerApi.Services;

public static class OrderCreditRules
{
    public static bool IsIdentifiedCustomer(string? name, string? phone)
    {
        var digits = new string((phone ?? "").Where(char.IsAsciiDigit).ToArray());
        return !string.IsNullOrWhiteSpace(name) && !name.Trim().Equals("Walk-in", StringComparison.OrdinalIgnoreCase)
            && digits.Length is >= 7 and <= 15 && digits.Any(c => c != '0');
    }
    public static string ReceivedMethod(string? method)
    {
        var value = (method ?? "").Trim().ToUpperInvariant();
        if (value is not ("CASH" or "CARD" or "BKASH" or "NAGAD" or "BANK" or "ROCKET" or "COD"))
            throw new InvalidOperationException("Choose the actual payment method. Due/Baki is not money received.");
        return value;
    }
}
