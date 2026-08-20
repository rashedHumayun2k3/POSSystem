using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Configuration;
using ResellerApi.Data;
using ResellerApi.DTOs.Auth;
using ResellerApi.DTOs.Subscriptions;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;
using Xunit;

namespace ResellerApi.Tests;

// First DB-backed AuthService test file in this project (existing tests only exercise stateless
// logic). Uses EF Core's InMemory provider with a fresh database per test.
public class AuthServicePasswordResetTests
{
    // SQL Server auto-populates the RowVer rowversion column on insert; the InMemory provider
    // does not, and AuthService's own methods never set it themselves (correctly — that's the
    // database's job in production). This subclass backfills it purely so InMemory-backed tests
    // don't choke on a null required column; production AppDbContext is untouched.
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

    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new TestAppDbContext(options, new BusinessContext());
    }

    private static AuthService NewService(AppDbContext db, FakeEmailSender? emailSender = null, FakeActivityLogService? activityLog = null) =>
        new(db, new ConfigurationBuilder().Build(), activityLog ?? new FakeActivityLogService(),
            emailSender ?? new FakeEmailSender(), new FakeSubscriptionService());

    private static User NewActiveUser(string email) => new()
    {
        CompanyId = Guid.NewGuid(),
        Name = "Test User",
        Phone = "01700000001",
        Email = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword("old-password"),
        Role = "OWNER",
        IsActive = true
    };

    // ── RequestPasswordResetCodeAsync ───────────────────────────────────────

    [Fact]
    public async Task RequestPasswordResetCode_KnownActiveUser_CreatesResetRowAndSendsEmail()
    {
        var db = NewDb();
        var user = NewActiveUser("owner@example.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);

        await sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com"));

        var rows = await db.EmailVerifications.ToListAsync();
        var row = Assert.Single(rows);
        Assert.Equal(EmailVerificationPurpose.PasswordReset, row.Purpose);
        Assert.Equal(1, emailSender.PasswordResetEmailsSent);
    }

    [Fact]
    public async Task RequestPasswordResetCode_UnknownEmail_ThrowsAndSendsNoEmail()
    {
        var db = NewDb();
        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("nobody@example.com")));

        Assert.Empty(await db.EmailVerifications.ToListAsync());
        Assert.Equal(0, emailSender.PasswordResetEmailsSent);
    }

    [Fact]
    public async Task RequestPasswordResetCode_UserWithNullEmail_ThrowsAndSendsNoEmail()
    {
        var db = NewDb();
        var user = NewActiveUser(null!);
        user.Email = null;
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com")));

        Assert.Empty(await db.EmailVerifications.ToListAsync());
        Assert.Equal(0, emailSender.PasswordResetEmailsSent);
    }

    [Fact]
    public async Task RequestPasswordResetCode_InactiveUser_ThrowsAndSendsNoEmail()
    {
        var db = NewDb();
        var user = NewActiveUser("owner@example.com");
        user.IsActive = false;
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com")));

        Assert.Empty(await db.EmailVerifications.ToListAsync());
        Assert.Equal(0, emailSender.PasswordResetEmailsSent);
    }

    // ── VerifyPasswordResetCodeAsync ────────────────────────────────────────

    [Fact]
    public async Task VerifyPasswordResetCode_CorrectCode_SetsVerifiedAt()
    {
        var db = NewDb();
        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);
        db.Users.Add(NewActiveUser("owner@example.com"));
        await db.SaveChangesAsync();

        await sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com"));
        var code = emailSender.LastPasswordResetCode!;

        await sut.VerifyPasswordResetCodeAsync(new VerifyPasswordResetRequest("owner@example.com", code));

        var row = await db.EmailVerifications.SingleAsync();
        Assert.NotNull(row.VerifiedAt);
    }

    [Fact]
    public async Task VerifyPasswordResetCode_WrongCode_IncrementsAttemptsAndThrows()
    {
        var db = NewDb();
        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);
        db.Users.Add(NewActiveUser("owner@example.com"));
        await db.SaveChangesAsync();
        await sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.VerifyPasswordResetCodeAsync(new VerifyPasswordResetRequest("owner@example.com", "000000")));

        var row = await db.EmailVerifications.SingleAsync();
        Assert.Equal(1, row.Attempts);
        Assert.Null(row.VerifiedAt);
    }

    [Fact]
    public async Task VerifyPasswordResetCode_SixthWrongAttempt_ThrowsTooManyAttempts()
    {
        var db = NewDb();
        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);
        db.Users.Add(NewActiveUser("owner@example.com"));
        await db.SaveChangesAsync();
        await sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com"));

        for (var i = 0; i < 5; i++)
        {
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                sut.VerifyPasswordResetCodeAsync(new VerifyPasswordResetRequest("owner@example.com", "000000")));
        }

        // 6th attempt, even with the correct code, must be rejected as "too many attempts".
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.VerifyPasswordResetCodeAsync(new VerifyPasswordResetRequest("owner@example.com", emailSender.LastPasswordResetCode!)));
        Assert.Contains("Too many", ex.Message);
    }

    [Fact]
    public async Task VerifyPasswordResetCode_DoesNotMatchSignupPurposeRow_RegressionForCollisionBug()
    {
        var db = NewDb();
        db.Users.Add(NewActiveUser("owner@example.com"));
        await db.SaveChangesAsync();

        // A stale SIGNUP-purpose row for the same email, with a code that would otherwise match.
        db.EmailVerifications.Add(new EmailVerification
        {
            Email = "owner@example.com",
            Purpose = EmailVerificationPurpose.Signup,
            CodeHash = HashCode("111111"),
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        });
        await db.SaveChangesAsync();

        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);
        await sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com"));

        // Verifying with the SIGNUP row's code must fail — only the PASSWORD_RESET row counts.
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.VerifyPasswordResetCodeAsync(new VerifyPasswordResetRequest("owner@example.com", "111111")));

        // The real reset code still works.
        await sut.VerifyPasswordResetCodeAsync(
            new VerifyPasswordResetRequest("owner@example.com", emailSender.LastPasswordResetCode!));
    }

    private static string HashCode(string code) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(code)));

    // ── CompletePasswordResetAsync ──────────────────────────────────────────

    [Fact]
    public async Task CompletePasswordReset_HappyPath_ChangesPasswordRevokesTokensAndLogsActivity()
    {
        var db = NewDb();
        var user = NewActiveUser("owner@example.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var business = new Business { CompanyId = user.CompanyId, Name = "Test Biz", Currency = "BDT" };
        db.Businesses.Add(business);
        db.BusinessUsers.Add(new BusinessUser { BusinessId = business.Id, UserId = user.Id });
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, Token = "old-token", ExpiresAt = DateTime.UtcNow.AddDays(30), IsRevoked = false });
        await db.SaveChangesAsync();

        var emailSender = new FakeEmailSender();
        var activityLog = new FakeActivityLogService();
        var sut = NewService(db, emailSender: emailSender, activityLog: activityLog);

        await sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com"));
        await sut.VerifyPasswordResetCodeAsync(new VerifyPasswordResetRequest("owner@example.com", emailSender.LastPasswordResetCode!));
        await sut.CompletePasswordResetAsync(new CompletePasswordResetRequest("owner@example.com", "new-password-123"));

        var updatedUser = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.True(BCrypt.Net.BCrypt.Verify("new-password-123", updatedUser.PasswordHash));
        Assert.False(BCrypt.Net.BCrypt.Verify("old-password", updatedUser.PasswordHash));

        var token = await db.RefreshTokens.SingleAsync(rt => rt.UserId == user.Id);
        Assert.True(token.IsRevoked);

        Assert.Single(activityLog.Entries);
        Assert.Equal("PASSWORD_RESET", activityLog.Entries[0].Action);
    }

    [Fact]
    public async Task CompletePasswordReset_OnlyRevokesTargetUsersTokens()
    {
        var db = NewDb();
        var user = NewActiveUser("owner@example.com");
        var otherUser = NewActiveUser("other@example.com");
        otherUser.Phone = "01700000002";
        db.Users.AddRange(user, otherUser);
        await db.SaveChangesAsync();

        var business = new Business { CompanyId = user.CompanyId, Name = "Test Biz", Currency = "BDT" };
        db.Businesses.Add(business);
        db.BusinessUsers.Add(new BusinessUser { BusinessId = business.Id, UserId = user.Id });
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, Token = "user-token", ExpiresAt = DateTime.UtcNow.AddDays(30), IsRevoked = false });
        db.RefreshTokens.Add(new RefreshToken { UserId = otherUser.Id, Token = "other-user-token", ExpiresAt = DateTime.UtcNow.AddDays(30), IsRevoked = false });
        await db.SaveChangesAsync();

        var emailSender = new FakeEmailSender();
        var sut = NewService(db, emailSender: emailSender);
        await sut.RequestPasswordResetCodeAsync(new RequestPasswordResetRequest("owner@example.com"));
        await sut.VerifyPasswordResetCodeAsync(new VerifyPasswordResetRequest("owner@example.com", emailSender.LastPasswordResetCode!));
        await sut.CompletePasswordResetAsync(new CompletePasswordResetRequest("owner@example.com", "new-password-123"));

        Assert.True((await db.RefreshTokens.SingleAsync(rt => rt.UserId == user.Id)).IsRevoked);
        Assert.False((await db.RefreshTokens.SingleAsync(rt => rt.UserId == otherUser.Id)).IsRevoked);
    }

    [Fact]
    public async Task CompletePasswordReset_OutsideVerifiedWindow_Throws()
    {
        var db = NewDb();
        var user = NewActiveUser("owner@example.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        db.EmailVerifications.Add(new EmailVerification
        {
            Email = "owner@example.com",
            Purpose = EmailVerificationPurpose.PasswordReset,
            CodeHash = HashCode("123456"),
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            VerifiedAt = DateTime.UtcNow.AddMinutes(-20) // outside the 15-minute verified window
        });
        await db.SaveChangesAsync();

        var sut = NewService(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.CompletePasswordResetAsync(new CompletePasswordResetRequest("owner@example.com", "new-password-123")));
    }

    [Fact]
    public async Task CompletePasswordReset_WithoutPriorVerify_Throws()
    {
        var db = NewDb();
        var user = NewActiveUser("owner@example.com");
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var sut = NewService(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sut.CompletePasswordResetAsync(new CompletePasswordResetRequest("owner@example.com", "new-password-123")));
    }

    // ── Test doubles ─────────────────────────────────────────────────────────

    private class FakeEmailSender : IEmailSender
    {
        public int PasswordResetEmailsSent { get; private set; }
        public string? LastPasswordResetCode { get; private set; }

        public Task SendVerificationCodeAsync(string email, string code, string? lang = null) => Task.CompletedTask;

        public Task SendPasswordResetCodeAsync(string email, string code, string? lang = null)
        {
            PasswordResetEmailsSent++;
            LastPasswordResetCode = code;
            return Task.CompletedTask;
        }

        public Task SendEmailWithAttachmentAsync(string email, string subject, string htmlBody,
            byte[] attachmentBytes, string attachmentFileName, string attachmentContentType) => Task.CompletedTask;
    }

    private class FakeActivityLogService : IActivityLogService
    {
        public record Entry(Guid BusinessId, Guid UserId, string Action, string EntityType, Guid? EntityId);
        public List<Entry> Entries { get; } = new();

        public Task LogAsync(Guid businessId, Guid userId, string action, string entityType,
            Guid? entityId = null, object? before = null, object? after = null)
        {
            Entries.Add(new Entry(businessId, userId, action, entityType, entityId));
            return Task.CompletedTask;
        }
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
