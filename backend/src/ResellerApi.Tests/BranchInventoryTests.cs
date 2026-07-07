using ResellerApi.Entities;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// Pure math/logic tests for branch/location support. Cover what's testable without a real
/// UPDLOCK-honoring database provider — the in-memory/SQLite EF providers don't enforce SQL
/// Server locking hints, so true concurrent-UPDLOCK behavior is verified by the manual
/// acceptance tests instead (see the branch/location implementation plan).
/// </summary>
public class BranchInventoryTests
{
    // BranchVariantInventory.Available must compute identically to the old single-pool
    // VariantInventory.Available (OnHand - Committed - Damaged) — same formula, just scoped
    // to one branch instead of the whole business.
    [Fact]
    public void BranchVariantInventory_Available_Equals_OnHand_Minus_Committed_Minus_Damaged()
    {
        var inv = new BranchVariantInventory
        {
            BranchId = Guid.NewGuid(),
            VariantId = Guid.NewGuid(),
            OnHand = 100m,
            Committed = 30m,
            Damaged = 5m,
        };

        Assert.Equal(65m, inv.Available);
    }

    // ProductVariant.AvgLandedCost is a business-level (cross-branch) figure. When a variant
    // already has stock in one branch and is then received into a second branch at a
    // different landed cost, the weighted average must be computed against the variant's
    // TRUE on-hand across all branches — not just the receiving branch's on-hand (which would
    // be 0 for a never-before-stocked branch, wrongly resetting the average).
    [Fact]
    public void AvgLandedCost_WeightedAcrossBranches_NotResetByNewBranch()
    {
        // Branch A already holds 100 units at avg cost 50 (established before this receive).
        var globalOnHandBeforeReceive = 100m;
        var existingAvgCost = 50m;

        // Branch B (never received this variant before) now receives 50 units at cost 80.
        var qtyReceivedIntoBranchB = 50m;
        var landedUnitCostForThisReceive = 80m;

        var newAvg = PurchaseTripService.ComputeNewAvgCost(
            globalOnHandBeforeReceive, existingAvgCost, qtyReceivedIntoBranchB, landedUnitCostForThisReceive);

        // (100*50 + 50*80) / 150 = 60 — a true global weighted average, not 80 (which is what
        // you'd wrongly get if "old on-hand" were read from Branch B alone, since Branch B's
        // own prior on-hand is 0).
        Assert.Equal(60m, newAvg);
    }

    // First-ever receive of a variant, at any branch: no prior stock anywhere, so the new
    // average is simply the landed cost of this receive — unaffected by which branch it is.
    [Fact]
    public void AvgLandedCost_FirstReceiveAnyBranch_EqualsLandedCost()
    {
        var newAvg = PurchaseTripService.ComputeNewAvgCost(0m, 0m, 40m, 72.50m);
        Assert.Equal(72.50m, newAvg);
    }
}
