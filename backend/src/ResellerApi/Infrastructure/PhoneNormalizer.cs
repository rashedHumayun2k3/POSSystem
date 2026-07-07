namespace ResellerApi.Infrastructure;

public static class PhoneNormalizer
{
    public static string Normalize(string phone)
    {
        phone = phone.Trim();
        if (phone.StartsWith("+88")) phone = phone[3..];
        if (phone.StartsWith("88") && phone.Length > 11) phone = phone[2..];
        return phone;
    }
}
