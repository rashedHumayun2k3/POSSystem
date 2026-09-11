using ResellerApi.Infrastructure;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// Acceptance tests for the Stock Valuation Report's pure formulas and the Dhaka-local preset
/// resolution (weighted avg buy price, velocity, months-of-stock-left, and the 28-day cutoff
/// that hides velocity for short ranges).
/// </summary>
public class StockValuationReportTests
{
    // ── Weighted avg buy price ───────────────────────────────────────────────────

    [Fact]
    public void WeightedAvgBuyPrice_TwoVariants_WeightedByOnHand()
    {
        // Variant A: 100 units @ 500, Variant B: 50 units @ 600
        // weighted = (100*500 + 50*600) / 150 = 80000 / 150 = 533.33
        var weightedCostSum = 100m * 500m + 50m * 600m;
        var avg = ReportService.WeightedAvgBuyPrice(150m, weightedCostSum);
        Assert.Equal(533.33m, avg);
    }

    [Fact]
    public void WeightedAvgBuyPrice_NoStock_ReturnsZero()
    {
        Assert.Equal(0m, ReportService.WeightedAvgBuyPrice(0m, 0m));
    }

    // ── Velocity cutoff ──────────────────────────────────────────────────────────

    [Fact]
    public void ShowVelocity_ExactlyTwentyEightDays_IsTrue()
    {
        Assert.True(ReportService.ShowVelocity(28));
    }

    [Fact]
    public void ShowVelocity_SevenDayRange_IsFalse()
    {
        Assert.False(ReportService.ShowVelocity(7));
    }

    [Fact]
    public void SoldPerMonth_HiddenWhenVelocityHidden()
    {
        Assert.Null(ReportService.SoldPerMonth(showVelocity: false, qtySold: 100m, monthsInRange: 1m));
    }

    [Fact]
    public void MonthsOfStockLeft_HiddenWhenVelocityHidden()
    {
        Assert.Null(ReportService.MonthsOfStockLeft(showVelocity: false, onHandQty: 100m, soldPerMonth: 50m));
    }

    // ── Sold-per-month / months-left ────────────────────────────────────────────

    [Fact]
    public void SoldPerMonth_OneMonthRange_EqualsQtySold()
    {
        var perMonth = ReportService.SoldPerMonth(showVelocity: true, qtySold: 60m, monthsInRange: 1m);
        Assert.Equal(60m, perMonth);
    }

    [Fact]
    public void MonthsOfStockLeft_OnHand100_Velocity50PerMonth_Equals2()
    {
        var monthsLeft = ReportService.MonthsOfStockLeft(showVelocity: true, onHandQty: 100m, soldPerMonth: 50m);
        Assert.Equal(2m, monthsLeft);
    }

    [Fact]
    public void MonthsOfStockLeft_ZeroVelocity_IsNull()
    {
        // Nothing sold in range — "months of stock left" is undefined, not infinite/zero.
        var monthsLeft = ReportService.MonthsOfStockLeft(showVelocity: true, onHandQty: 100m, soldPerMonth: 0m);
        Assert.Null(monthsLeft);
    }

    // ── Dhaka-local preset resolution ───────────────────────────────────────────

    [Fact]
    public void ResolvePreset_ThisMonth_ToExclusiveIsSixHoursAheadOfLocalMidnight()
    {
        // Asia/Dhaka is a fixed UTC+6 — the exclusive upper bound (start of the day AFTER the
        // last included local day) must be 6 hours EARLIER in UTC than the naive local midnight,
        // e.g. local midnight of the 1st is 18:00 UTC the day before.
        var range = DhakaTime.ResolvePreset("this_month", null, null);
        var expectedToExclusiveUtc = DhakaTime.LocalToUtc(range.ToLocalDate.AddDays(1));
        Assert.Equal(expectedToExclusiveUtc, range.ToExclusiveUtc);
        Assert.True(range.FromUtc < range.ToExclusiveUtc);
    }

    [Fact]
    public void ResolvePreset_LastMonth_EndsBeforeThisMonthStarts()
    {
        var thisMonth = DhakaTime.ResolvePreset("this_month", null, null);
        var lastMonth = DhakaTime.ResolvePreset("last_month", null, null);
        Assert.True(lastMonth.ToExclusiveUtc <= thisMonth.FromUtc);
    }

    [Fact]
    public void ResolvePreset_Custom_UsesGivenDates()
    {
        var from = new DateTime(2026, 1, 1);
        var to = new DateTime(2026, 1, 7);
        var range = DhakaTime.ResolvePreset("custom", from, to);
        Assert.Equal(from, range.FromLocalDate);
        Assert.Equal(to, range.ToLocalDate);
        // 7-day inclusive range = 7 days, below the 28-day velocity cutoff.
        Assert.False(ReportService.ShowVelocity((range.ToExclusiveUtc - range.FromUtc).TotalDays));
    }
}
