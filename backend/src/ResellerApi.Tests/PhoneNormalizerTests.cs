using ResellerApi.Infrastructure;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// Signup/login share phone normalization — this guards against the two formats
/// (+8801XXXXXXXXX vs 01XXXXXXXXX) being treated as different accounts.
/// </summary>
public class PhoneNormalizerTests
{
    [Fact]
    public void Normalize_PlainLocalFormat_Unchanged()
    {
        Assert.Equal("01712345678", PhoneNormalizer.Normalize("01712345678"));
    }

    [Fact]
    public void Normalize_PlusCountryCode_StripsPrefix()
    {
        Assert.Equal("01712345678", PhoneNormalizer.Normalize("+8801712345678"));
    }

    [Fact]
    public void Normalize_BareCountryCode_StripsPrefix()
    {
        Assert.Equal("01712345678", PhoneNormalizer.Normalize("8801712345678"));
    }

    [Fact]
    public void Normalize_TrimsWhitespace()
    {
        Assert.Equal("01712345678", PhoneNormalizer.Normalize("  01712345678  "));
    }

    [Fact]
    public void Normalize_DifferentFormats_ProduceSameResult()
    {
        var a = PhoneNormalizer.Normalize("01712345678");
        var b = PhoneNormalizer.Normalize("+8801712345678");
        var c = PhoneNormalizer.Normalize("8801712345678");
        Assert.Equal(a, b);
        Assert.Equal(b, c);
    }
}
