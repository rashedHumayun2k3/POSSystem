namespace ResellerApi.Infrastructure;

public static class EmailMasker
{
    public static string Mask(string email)
    {
        var at = email.IndexOf('@');
        if (at < 0) return email;

        var local = email[..at];
        var domain = email[(at + 1)..];
        var dotIndex = domain.IndexOf('.');
        var domainLabel = dotIndex >= 0 ? domain[..dotIndex] : domain;
        var domainRest = dotIndex >= 0 ? domain[dotIndex..] : "";

        return $"{MaskPart(local)}@{MaskPart(domainLabel)}{domainRest}";
    }

    private static string MaskPart(string part) =>
        part.Length <= 1 ? "*" : $"{part[0]}***{part[^1]}";
}
