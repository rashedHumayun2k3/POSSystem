using ResellerApi.Services;

namespace ResellerApi.Tests;

public class OrderRevisionStockTests
{
    [Fact]
    public void Increase_ReservesOnlyAdditionalUnits()
    {
        Assert.Equal(7m, OrderMath.ComputeRevisedCommitted(10m, 5m, 1m, 1m, 3m));
    }

    [Fact]
    public void Increase_AllowsExactlyAvailableStock()
    {
        Assert.Equal(9m, OrderMath.ComputeRevisedCommitted(10m, 5m, 1m, 1m, 5m));
    }

    [Theory]
    [InlineData(10, 5, 1, 1, 6)]
    [InlineData(1, 1, 0, 1, 2)]
    public void Increase_RejectsUnavailableOrDamagedStock(decimal onHand, decimal committed, decimal damaged, decimal oldQty, decimal newQty)
    {
        Assert.Throws<InvalidOperationException>(() => OrderMath.ComputeRevisedCommitted(onHand, committed, damaged, oldQty, newQty));
    }

    [Theory]
    [InlineData(3, 1, 3)]
    [InlineData(3, 0, 2)]
    public void Reduction_ReleasesOnlyRemovedUnits(decimal oldQty, decimal newQty, decimal expected)
    {
        Assert.Equal(expected, OrderMath.ComputeRevisedCommitted(10m, 5m, 1m, oldQty, newQty));
    }
}
