using ResellerApi.Infrastructure;
using Xunit;

namespace ResellerApi.Tests;

public class EmailMaskerTests
{
    [Theory]
    [InlineData("rashed@gmail.com", "r***d@g***l.com")]
    [InlineData("a@b.com", "*@*.com")]
    [InlineData("jo@yahoo.co.uk", "j***o@y***o.co.uk")]
    [InlineData("owner@example.com", "o***r@e***e.com")]
    public void Mask_ProducesExpectedPattern(string input, string expected)
    {
        Assert.Equal(expected, EmailMasker.Mask(input));
    }
}
