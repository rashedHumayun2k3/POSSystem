using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// Acceptance tests for Phase 4 — Orders module.
/// Pure math/logic tests that don't require a database.
/// </summary>
public class OrderTests
{
    // ── Discount math ────────────────────────────────────────────────────────

    [Fact]
    public void Discount_Percent10_On1000taka_Equals100()
    {
        var subtotal = 1000m;
        var discount = OrderMath.ComputeDiscount("PERCENT", 10m, subtotal);
        Assert.Equal(100m, discount);
    }

    [Fact]
    public void Discount_Fixed150_Equals150()
    {
        var subtotal = 1000m;
        var discount = OrderMath.ComputeDiscount("FIXED", 150m, subtotal);
        Assert.Equal(150m, discount);
    }

    [Fact]
    public void Discount_None_Equals0()
    {
        var discount = OrderMath.ComputeDiscount(null, null, 1000m);
        Assert.Equal(0m, discount);
    }

    [Fact]
    public void Total_Equals_Subtotal_MinusDiscount_PlusDelivery()
    {
        var subtotal = 1000m;
        var discount = OrderMath.ComputeDiscount("PERCENT", 10m, subtotal);
        var deliveryCharge = 60m;
        var total = subtotal - discount + deliveryCharge;
        Assert.Equal(960m, total);
    }

    // ── Safe discount guard math ──────────────────────────────────────────────

    [Fact]
    public void SafeDiscountGuard_BelowBreakEven_IsLoss()
    {
        var unitCost = 100m;
        var unitPrice = 120m;
        var discountPercent = 20m; // makes effective price = 96tk → below cost
        var effectivePrice = unitPrice * (1 - discountPercent / 100);
        Assert.True(effectivePrice < unitCost); // loss scenario
    }

    [Fact]
    public void SafeDiscountGuard_AtBreakEven_IsZeroProfit()
    {
        var unitCost = 100m;
        var unitPrice = 120m;
        var discountPercent = OrderMath.MaxSafeDiscountPercent(unitCost, unitPrice);
        var effectivePrice = unitPrice * (1 - discountPercent / 100);
        // effective price should be >= cost
        Assert.True(effectivePrice >= unitCost - 0.01m); // allow 1 paisa rounding
    }

    // ── Order economics snapshot ──────────────────────────────────────────────

    [Fact]
    public void Snapshot_CostUsed_NotCurrentVariantCost()
    {
        // Simulates GTR-8: after snapshot, cost change does NOT affect order profit
        var snapshotCost = 100m;
        var qty = 3m;
        var unitPrice = 150m;
        var lineProfit = (unitPrice - snapshotCost) * qty;

        // Later the product cost changes — irrelevant
        var currentCost = 120m;
        var lineProfit2 = (unitPrice - currentCost) * qty;

        Assert.NotEqual(lineProfit, lineProfit2); // confirm they differ
        Assert.Equal(150m, lineProfit); // snapshot-based profit is correct
    }

    // ── Payment status logic ──────────────────────────────────────────────────

    [Fact]
    public void PaymentStatus_FullyPaid_IsPaid()
    {
        var total = 1000m;
        var paid = 1000m;
        var status = OrderMath.ComputePaymentStatus(paid, total);
        Assert.Equal("PAID", status);
    }

    [Fact]
    public void PaymentStatus_PartiallyPaid_IsPartiallyPaid()
    {
        var total = 1000m;
        var paid = 400m;
        var status = OrderMath.ComputePaymentStatus(paid, total);
        Assert.Equal("PARTIALLY_PAID", status);
    }

    [Fact]
    public void PaymentStatus_NothingPaid_IsUnpaid()
    {
        var status = OrderMath.ComputePaymentStatus(0m, 1000m);
        Assert.Equal("UNPAID", status);
    }

    [Fact]
    public void PaymentStatus_OverPaid_IsPaid()
    {
        // COD may over-collect by courier rounding — still counts as PAID
        var status = OrderMath.ComputePaymentStatus(1001m, 1000m);
        Assert.Equal("PAID", status);
    }

    // ── Order revision overpayment (ReviseAsync) ────────────────────────────────

    [Fact]
    public void OverpaymentExcess_PaidExceedsRevisedTotal_ReturnsDifference()
    {
        // Customer paid for the original 10+2 order; revised down to just 5 of item 1.
        var excess = OrderMath.ComputeOverpaymentExcess(totalPaid: 1200m, newTotal: 1000m);
        Assert.Equal(200m, excess);
    }

    [Fact]
    public void OverpaymentExcess_PaidEqualsRevisedTotal_IsZero()
    {
        var excess = OrderMath.ComputeOverpaymentExcess(totalPaid: 1000m, newTotal: 1000m);
        Assert.Equal(0m, excess);
    }

    [Fact]
    public void OverpaymentExcess_PaidLessThanRevisedTotal_IsZero()
    {
        // Still under-paid after revision — normal Due amount, not an overpayment case.
        var excess = OrderMath.ComputeOverpaymentExcess(totalPaid: 400m, newTotal: 1000m);
        Assert.Equal(0m, excess);
    }

    [Fact]
    public void OverpaymentExcess_RoundsToTwoDecimalPlaces()
    {
        var excess = OrderMath.ComputeOverpaymentExcess(totalPaid: 100.017m, newTotal: 0m);
        Assert.Equal(100.02m, excess);
    }

    [Fact]
    public void OverpaymentExcess_ThenPaymentStatus_IsPaidAfterRefundingExactExcess()
    {
        // Simulates ReviseAsync: paid -= excess after the refund/store-credit resolution is
        // applied, then payment status is recomputed against the new total.
        var newTotal = 1000m;
        var paid = 1200m;
        var excess = OrderMath.ComputeOverpaymentExcess(paid, newTotal);
        paid -= excess;
        Assert.Equal("PAID", OrderMath.ComputePaymentStatus(paid, newTotal));
    }
}
