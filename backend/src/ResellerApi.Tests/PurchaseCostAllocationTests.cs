using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// Acceptance tests for R5.6 landed cost formulas.
/// </summary>
public class PurchaseCostAllocationTests
{
    // R5.6 worked example 1: 1 item, qty 100 (all usable), cost 10,000
    // shared: transport 100 + labor 200 + other 10 = 310
    // landed = (10000 + 310) / 100 = 103.10
    [Fact]
    public void LandedCost_SingleItem_AllUsable()
    {
        var (allocated, landed) = PurchaseTripService.ComputeLandedCost(10_000m, 10_000m, 310m, 100m);
        Assert.Equal(310m, allocated);
        Assert.Equal(103.10m, landed);
    }

    // R5.6 worked example 2: prior 50 @ 100 → new avg
    // (50×100 + 100×103.10) / 150 = 15310 / 150 = 102.07
    [Fact]
    public void NewAvgCost_WithPriorStock()
    {
        var newAvg = PurchaseTripService.ComputeNewAvgCost(50m, 100m, 100m, 103.10m);
        Assert.Equal(102.07m, newAvg);
    }

    // R5.6 worked example 3: damaged-on-arrival, usable 95
    // landed = 10310 / 95 = 108.53
    [Fact]
    public void LandedCost_DamagedOnArrival_UsableQty95()
    {
        var (allocated, landed) = PurchaseTripService.ComputeLandedCost(10_000m, 10_000m, 310m, 95m);
        Assert.Equal(310m, allocated);
        Assert.Equal(108.53m, landed);
    }

    // Multi-item allocation: shared costs split proportionally to each item's total_cost
    [Fact]
    public void LandedCost_MultiItem_ProportionalAllocation()
    {
        // item A: cost 6000, item B: cost 4000; total = 10000; shared = 1000
        var (allocA, landedA) = PurchaseTripService.ComputeLandedCost(6_000m, 10_000m, 1_000m, 60m);
        var (allocB, landedB) = PurchaseTripService.ComputeLandedCost(4_000m, 10_000m, 1_000m, 40m);

        Assert.Equal(600m, allocA);
        Assert.Equal(110m, landedA);  // (6000 + 600) / 60 = 110

        Assert.Equal(400m, allocB);
        Assert.Equal(110m, landedB);  // (4000 + 400) / 40 = 110
    }

    // No shared costs: landed = total_cost / qty
    [Fact]
    public void LandedCost_NoSharedCosts()
    {
        var (allocated, landed) = PurchaseTripService.ComputeLandedCost(5_000m, 5_000m, 0m, 50m);
        Assert.Equal(0m, allocated);
        Assert.Equal(100m, landed);
    }

    // Zero prior stock: new avg equals landed unit cost
    [Fact]
    public void NewAvgCost_NoPriorStock()
    {
        var newAvg = PurchaseTripService.ComputeNewAvgCost(0m, 0m, 100m, 103.10m);
        Assert.Equal(103.10m, newAvg);
    }
}
