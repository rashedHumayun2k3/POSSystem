using ResellerApi.Infrastructure;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// A business can operate multiple sales channels at once (e.g. Hawker + Online) — this list is
/// stored as a JSON string on Business.SalesChannelsJson, so round-tripping must be exact.
/// </summary>
public class SalesChannelsTests
{
    [Fact]
    public void ParseJson_Null_ReturnsEmptyArray()
    {
        Assert.Empty(SalesChannels.ParseJson(null));
    }

    [Fact]
    public void ParseJson_EmptyString_ReturnsEmptyArray()
    {
        Assert.Empty(SalesChannels.ParseJson(""));
    }

    [Fact]
    public void ToJson_ThenParseJson_RoundTripsMultipleValues()
    {
        var original = new[] { SalesChannels.Hawker, SalesChannels.Online };
        var json = SalesChannels.ToJson(original);
        var parsed = SalesChannels.ParseJson(json);
        Assert.Equal(original, parsed);
    }

    [Fact]
    public void ToJson_ThenParseJson_RoundTripsSingleValue()
    {
        var json = SalesChannels.ToJson(new[] { SalesChannels.Pos });
        Assert.Equal(new[] { SalesChannels.Pos }, SalesChannels.ParseJson(json));
    }
}
