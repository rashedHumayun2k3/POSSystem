using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Configuration;
using ResellerApi.Data;
using ResellerApi.DTOs.Auth;
using ResellerApi.DTOs.Subscriptions;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;
using Xunit;

namespace ResellerApi.Tests;

// Only the "invalid token" branch is unit-testable without a real Google-signed JWT — a
// malformed token fails JWT parsing locally, before any network call to fetch Google's
// certs, so no network access is needed here. The happy path (valid token → email
// extracted → EmailVerification row created) can't be exercised without a real Google
// ID token and is covered by manual verification instead (see plan doc).
public class AuthServiceGoogleVerifyEmailTests
{
    private class TestAppDbContext(DbContextOptions<AppDbContext> options, IBusinessContext businessContext)
        : AppDbContext(options, businessContext)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<BaseEntity>())
            {
                if (entry.State == EntityState.Added && entry.Entity.RowVer is null)
                    entry.Entity.RowVer = Guid.NewGuid().ToByteArray();
            }
            return base.SaveChangesAsync(cancellationToken);
        }
    }

    private static AuthService NewService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new TestAppDbContext(options, new BusinessContext());
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Google:ClientId"] = "test-client-id" })
            .Build();
        return new AuthService(db, config, new FakeActivityLogService(), new FakeEmailSender(), new FakeSubscriptionService());
    }

    [Fact]
    public async Task VerifySignupEmailViaGoogle_MalformedToken_ThrowsUnauthorized()
    {
        var sut = NewService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            sut.VerifySignupEmailViaGoogleAsync(new GoogleVerifyEmailRequest("not-a-valid-jwt")));
    }

    private class FakeEmailSender : IEmailSender
    {
        public Task SendVerificationCodeAsync(string email, string code) => Task.CompletedTask;
        public Task SendPasswordResetCodeAsync(string email, string code) => Task.CompletedTask;
    }

    private class FakeActivityLogService : IActivityLogService
    {
        public Task LogAsync(Guid businessId, Guid userId, string action, string entityType,
            Guid? entityId = null, object? before = null, object? after = null) => Task.CompletedTask;
    }

    private class FakeSubscriptionService : ISubscriptionService
    {
        public Task StartTrialAsync(Guid companyId) => throw new NotImplementedException();
        public Task<List<SubscriptionPlanDto>> GetPurchasablePlansAsync() => throw new NotImplementedException();
        public Task<SubscriptionStatusDto> GetStatusAsync(Guid companyId) => throw new NotImplementedException();
        public Task EnsureCanAddStaffAsync(Guid companyId) => throw new NotImplementedException();
        public Task EnsureCanAddBranchAsync(Guid companyId) => throw new NotImplementedException();
        public Task<bool> IsReadOnlyLockedAsync(Guid companyId) => throw new NotImplementedException();
        public Task<StartCheckoutResponse> StartCheckoutAsync(Guid companyId, StartCheckoutRequest request) => throw new NotImplementedException();
        public Task HandleBkashCallbackAsync(string paymentId, string bkashStatus) => throw new NotImplementedException();
        public Task ExpireDueSubscriptionsAsync() => throw new NotImplementedException();
    }
}
