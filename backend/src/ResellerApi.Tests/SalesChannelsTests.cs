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

    // ── IsValidCombination ──────────────────────────────────────────────────
    // A business is either a full-barcode-scanner setup (Pos) or a lightweight one (Hawker),
    // never both — Online is freely combinable with either.

    [Fact]
    public void IsValidCombination_PosAndHawker_ReturnsFalse()
    {
        Assert.False(SalesChannels.IsValidCombination(new[] { SalesChannels.Pos, SalesChannels.Hawker }));
    }

    [Fact]
    public void IsValidCombination_AllThree_ReturnsFalse()
    {
        Assert.False(SalesChannels.IsValidCombination(new[] { SalesChannels.Pos, SalesChannels.Hawker, SalesChannels.Online }));
    }

    [Fact]
    public void IsValidCombination_PosAndOnline_ReturnsTrue()
    {
        Assert.True(SalesChannels.IsValidCombination(new[] { SalesChannels.Pos, SalesChannels.Online }));
    }

    [Fact]
    public void IsValidCombination_HawkerAndOnline_ReturnsTrue()
    {
        Assert.True(SalesChannels.IsValidCombination(new[] { SalesChannels.Hawker, SalesChannels.Online }));
    }

    [Fact]
    public void IsValidCombination_PosAlone_ReturnsTrue()
    {
        Assert.True(SalesChannels.IsValidCombination(new[] { SalesChannels.Pos }));
    }

    [Fact]
    public void IsValidCombination_HawkerAlone_ReturnsTrue()
    {
        Assert.True(SalesChannels.IsValidCombination(new[] { SalesChannels.Hawker }));
    }

    [Theory]
    [InlineData(ShopTypes.SmallShowroom)]
    [InlineData(ShopTypes.HawkerShop)]
    public void ShopType_HawkerBasedTypes_MatchSameChannels(string shopType)
    {
        Assert.True(ShopTypes.MatchesChannels(
            shopType,
            new[] { SalesChannels.Hawker, SalesChannels.Online }));
    }

    [Fact]
    public void ShopType_BigSupershop_DoesNotMatchHawkerChannels()
    {
        Assert.False(ShopTypes.MatchesChannels(
            ShopTypes.BigSupershop,
            new[] { SalesChannels.Hawker, SalesChannels.Online }));
    }

    [Fact]
    public void ShopType_FromLegacyHawkerChannels_DefaultsToHawkerShop()
    {
        Assert.Equal(
            ShopTypes.HawkerShop,
            ShopTypes.FromChannels(new[] { SalesChannels.Hawker, SalesChannels.Online }));
    }
}
