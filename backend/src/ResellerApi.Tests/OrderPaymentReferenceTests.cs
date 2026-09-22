using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

public class OrderPaymentReferenceTests
{
    [Theory]
    [InlineData("BKASH", null, null)]
    [InlineData("NAGAD", "   ", null)]
    [InlineData("BKASH", "  TX123  ", "TX123")]
    [InlineData("NAGAD", "001234", "001234")]
    [InlineData("CARD", " receipt-123 ", "receipt-123")]
    [InlineData("CASH", "stale-reference", null)]
    public void NormalizesOptionalReference(string method, string? input, string? expected)
        => Assert.Equal(expected, OrderPaymentReference.Normalize(method, input));

    [Theory]
    [InlineData("BKASH")]
    [InlineData("NAGAD")]
    [InlineData("CARD")]
    public void EnforcesMaximumLength(string method)
    {
        Assert.Equal(new string('A', 100), OrderPaymentReference.Normalize(method, new string('A', 100)));
        Assert.Throws<InvalidOperationException>(() => OrderPaymentReference.Normalize(method, new string('A', 101)));
    }
}
