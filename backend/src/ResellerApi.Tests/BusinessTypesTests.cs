using ResellerApi.Infrastructure;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// A business can select multiple types (e.g. Clothing + Toys) — this list is stored as a
/// JSON string on Business.BusinessTypesJson, so round-tripping must be exact.
/// </summary>
public class BusinessTypesTests
{
    [Fact]
    public void ParseJson_Null_ReturnsEmptyArray()
    {
        Assert.Empty(BusinessTypes.ParseJson(null));
    }

    [Fact]
    public void ParseJson_EmptyString_ReturnsEmptyArray()
    {
        Assert.Empty(BusinessTypes.ParseJson(""));
    }

    [Fact]
    public void ToJson_ThenParseJson_RoundTripsMultipleValues()
    {
        var original = new[] { BusinessTypes.ClothingFashion, BusinessTypes.ToysBaby };
        var json = BusinessTypes.ToJson(original);
        var parsed = BusinessTypes.ParseJson(json);
        Assert.Equal(original, parsed);
    }

    [Fact]
    public void ToJson_ThenParseJson_RoundTripsSingleValue()
    {
        var json = BusinessTypes.ToJson(new[] { BusinessTypes.Other });
        Assert.Equal(new[] { BusinessTypes.Other }, BusinessTypes.ParseJson(json));
    }
}
