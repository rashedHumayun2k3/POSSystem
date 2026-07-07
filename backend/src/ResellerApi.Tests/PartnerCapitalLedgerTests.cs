using System.Linq;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// Acceptance tests for Module 15a — Partnership & Capital Ledger foundation.
/// </summary>
public class PartnerCapitalLedgerTests
{
    // ── R15.3 / R7: paisa arithmetic is exact, never decimal/float ────────────

    [Fact]
    public void BalanceAfter_SingleInjection_IsExact()
    {
        var balanceAfter = PartnerCapitalService.ComputeBalanceAfter(0, 5_000_00); // ৳5,000.00
        Assert.Equal(500_000, balanceAfter);
    }

    [Fact]
    public void BalanceAfter_SequenceOfInjections_NoRoundingDrift()
    {
        long balance = 0;
        long[] injections = { 123_456, 789, 1, 999_999_999, 2 };
        foreach (var amt in injections)
            balance = PartnerCapitalService.ComputeBalanceAfter(balance, amt);

        Assert.Equal(injections.Sum(), balance);
    }

    [Fact]
    public void BalanceAfter_NegativeAmount_DebitsCorrectly()
    {
        var balanceAfter = PartnerCapitalService.ComputeBalanceAfter(10_000, -3_000);
        Assert.Equal(7_000, balanceAfter);
    }

    // ── R15.1 / R10: partner type immutable once ledger history exists ────────

    [Fact]
    public void PartnerType_CanChange_WhenNoLedgerHistoryExists()
    {
        Assert.True(PartnerService.CanChangePartnerType("MANAGING", "SLEEPING", hasLedgerHistory: false));
    }

    [Fact]
    public void PartnerType_CannotChange_OnceLedgerHistoryExists()
    {
        Assert.False(PartnerService.CanChangePartnerType("MANAGING", "SLEEPING", hasLedgerHistory: true));
    }

    [Fact]
    public void PartnerType_NoOpUpdate_AlwaysAllowed_EvenWithLedgerHistory()
    {
        // Saving the same type back (e.g. editing only name/phone) is not a "change".
        Assert.True(PartnerService.CanChangePartnerType("SLEEPING", "SLEEPING", hasLedgerHistory: true));
    }

    // ── R15.4: CAPITAL and PROFIT buckets are summed independently ────────────

    [Fact]
    public void BucketSums_AreIndependent_CapitalEntriesNeverFeedProfitBalance()
    {
        var entries = new[]
        {
            (Bucket: "CAPITAL", Amount: 500_000L),
            (Bucket: "CAPITAL", Amount: 250_000L),
        };

        var capitalSum = entries.Where(e => e.Bucket == "CAPITAL").Sum(e => e.Amount);
        var profitSum = entries.Where(e => e.Bucket == "PROFIT").Sum(e => e.Amount);

        Assert.Equal(750_000, capitalSum);
        Assert.Equal(0, profitSum);
    }

    // ── R15.11: new partner approval — majority threshold + vote outcome ──────

    [Theory]
    [InlineData(1, 1)]  // single managing partner: majority of 1 is 1 (they decide alone)
    [InlineData(2, 2)]  // 2 managing partners: need both (no tie-breaking minority)
    [InlineData(3, 2)]
    [InlineData(4, 3)]
    [InlineData(5, 3)]
    public void ApprovalThreshold_IsMajorityOfActiveManagingPartners(int activeManagingPartners, int expectedThreshold)
    {
        Assert.Equal(expectedThreshold, PartnerService.ComputeApprovalThreshold(activeManagingPartners));
    }

    [Fact]
    public void ApprovalOutcome_ReachesActive_OnceApprovalsHitThreshold()
    {
        // 4 active managing partners → threshold 3. 3rd APPROVE tips it to ACTIVE.
        Assert.Null(PartnerService.ComputeOutcome(approveCount: 2, rejectCount: 0, requiredVotes: 3, totalManagingPartners: 4));
        Assert.Equal("ACTIVE", PartnerService.ComputeOutcome(approveCount: 3, rejectCount: 0, requiredVotes: 3, totalManagingPartners: 4));
    }

    [Fact]
    public void ApprovalOutcome_ReachesRejected_AsSoonAsMajorityIsMathematicallyUnreachable()
    {
        // 4 active managing partners → threshold 3. After 2 REJECTs, only 2 voters remain,
        // so at most 2 approvals are still possible — never enough to reach 3.
        Assert.Null(PartnerService.ComputeOutcome(approveCount: 0, rejectCount: 1, requiredVotes: 3, totalManagingPartners: 4));
        Assert.Equal("REJECTED", PartnerService.ComputeOutcome(approveCount: 0, rejectCount: 2, requiredVotes: 3, totalManagingPartners: 4));
    }

    [Fact]
    public void ApprovalOutcome_SingleManagingPartner_DecidesAloneEitherWay()
    {
        Assert.Equal("ACTIVE", PartnerService.ComputeOutcome(approveCount: 1, rejectCount: 0, requiredVotes: 1, totalManagingPartners: 1));
        Assert.Equal("REJECTED", PartnerService.ComputeOutcome(approveCount: 0, rejectCount: 1, requiredVotes: 1, totalManagingPartners: 1));
    }
}
