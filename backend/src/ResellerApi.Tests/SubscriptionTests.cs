using ResellerApi.Entities;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

/// <summary>
/// Pure logic tests for the subscription read-only-lockout rule. This is the single formula
/// that gates every mutating request once a trial/subscription lapses, so it's worth covering
/// every status/date combination directly rather than only through integration tests.
/// </summary>
public class SubscriptionTests
{
    [Fact]
    public void Trialing_WithFutureTrialEnd_IsNotExpired()
    {
        var sub = new Subscription { Status = "TRIALING", TrialEndsAt = DateTime.UtcNow.AddDays(5) };
        Assert.False(SubscriptionService.IsExpired(sub));
    }

    [Fact]
    public void Trialing_WithPastTrialEnd_IsExpired_EvenBeforeHangfireJobRuns()
    {
        // The hourly Hangfire job flips Status to EXPIRED, but the gate must not have to wait
        // for that — a trial that ended 2 minutes ago must lock out immediately.
        var sub = new Subscription { Status = "TRIALING", TrialEndsAt = DateTime.UtcNow.AddMinutes(-2) };
        Assert.True(SubscriptionService.IsExpired(sub));
    }

    [Fact]
    public void Active_WithFuturePeriodEnd_IsNotExpired()
    {
        var sub = new Subscription { Status = "ACTIVE", CurrentPeriodEnd = DateTime.UtcNow.AddDays(20) };
        Assert.False(SubscriptionService.IsExpired(sub));
    }

    [Fact]
    public void Active_WithPastPeriodEnd_IsExpired()
    {
        var sub = new Subscription { Status = "ACTIVE", CurrentPeriodEnd = DateTime.UtcNow.AddDays(-1) };
        Assert.True(SubscriptionService.IsExpired(sub));
    }

    [Theory]
    [InlineData("EXPIRED")]
    [InlineData("PAST_DUE")]
    [InlineData("CANCELED")]
    public void TerminalStatuses_AreAlwaysExpired(string status)
    {
        var sub = new Subscription { Status = status };
        Assert.True(SubscriptionService.IsExpired(sub));
    }
}
