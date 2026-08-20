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

public class AuthServiceFindMyEmailTests
{
    // Same InMemory RowVer-backfill workaround as AuthServicePasswordResetTests — see that file
    // for the full explanation.
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

    private static AuthService NewService(AppDbContext db) =>
        new(db, new ConfigurationBuilder().Build(), new FakeActivityLogService(),
            new FakeEmailSender(), new FakeSubscriptionService());

    private static (User Owner, Company Company, Business Business) SeedOwnerWithShop(
        AppDbContext db, string phone, string? email, string shopName, bool isActive = true, string role = "OWNER")
    {
        var company = new Company { Name = "Test Co" };
        db.Companies.Add(company);

        var business = new Business { CompanyId = company.Id, Name = shopName, Currency = "BDT" };
        db.Businesses.Add(business);

        var owner = new User
        {
            CompanyId = company.Id,
            Name = "Test Owner",
            Phone = phone,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
            Role = role,
            IsActive = isActive
        };
        db.Users.Add(owner);

        return (owner, company, business);
    }

    [Fact]
    public async Task FindMyEmail_MatchingPhoneAndShopName_ReturnsMaskedEmail()
    {
        var db = NewDb();
        SeedOwnerWithShop(db, "01700000001", "rashed@gmail.com", "My Shop");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.FindMyEmailAsync(new FindMyEmailRequest("01700000001", "My Shop"));

        Assert.True(result.Found);
        Assert.Equal("r***d@g***l.com", result.MaskedEmail);
    }

    [Fact]
    public async Task FindMyEmail_ShopNameMatchIsCaseAndWhitespaceInsensitive()
    {
        var db = NewDb();
        SeedOwnerWithShop(db, "01700000001", "rashed@gmail.com", "My Shop");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.FindMyEmailAsync(new FindMyEmailRequest("01700000001", "  my SHOP  "));

        Assert.True(result.Found);
    }

    [Fact]
    public async Task FindMyEmail_WrongShopName_ReturnsNotFound()
    {
        var db = NewDb();
        SeedOwnerWithShop(db, "01700000001", "rashed@gmail.com", "My Shop");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.FindMyEmailAsync(new FindMyEmailRequest("01700000001", "Someone Else's Shop"));

        Assert.False(result.Found);
        Assert.Null(result.MaskedEmail);
    }

    [Fact]
    public async Task FindMyEmail_UnknownPhone_ReturnsNotFound()
    {
        var db = NewDb();
        SeedOwnerWithShop(db, "01700000001", "rashed@gmail.com", "My Shop");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.FindMyEmailAsync(new FindMyEmailRequest("01799999999", "My Shop"));

        Assert.False(result.Found);
        Assert.Null(result.MaskedEmail);
    }

    [Fact]
    public async Task FindMyEmail_InactiveUser_ReturnsNotFound()
    {
        var db = NewDb();
        SeedOwnerWithShop(db, "01700000001", "rashed@gmail.com", "My Shop", isActive: false);
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.FindMyEmailAsync(new FindMyEmailRequest("01700000001", "My Shop"));

        Assert.False(result.Found);
    }

    [Fact]
    public async Task FindMyEmail_StaffUserNotOwner_ReturnsNotFound()
    {
        var db = NewDb();
        SeedOwnerWithShop(db, "01700000001", "staff@gmail.com", "My Shop", role: "STAFF");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.FindMyEmailAsync(new FindMyEmailRequest("01700000001", "My Shop"));

        Assert.False(result.Found);
    }

    [Fact]
    public async Task FindMyEmail_MatchedPhoneAndShopButNoEmailOnFile_ReturnsNotFound()
    {
        var db = NewDb();
        SeedOwnerWithShop(db, "01700000001", null, "My Shop");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.FindMyEmailAsync(new FindMyEmailRequest("01700000001", "My Shop"));

        Assert.False(result.Found);
        Assert.Null(result.MaskedEmail);
    }

    [Fact]
    public async Task FindMyEmail_NormalizesPhoneWithCountryCode()
    {
        var db = NewDb();
        SeedOwnerWithShop(db, "01700000001", "rashed@gmail.com", "My Shop");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.FindMyEmailAsync(new FindMyEmailRequest("+8801700000001", "My Shop"));

        Assert.True(result.Found);
    }

    // ── Test doubles ─────────────────────────────────────────────────────────

    private class FakeEmailSender : IEmailSender
    {
        public Task SendVerificationCodeAsync(string email, string code, string? lang = null) => Task.CompletedTask;
        public Task SendPasswordResetCodeAsync(string email, string code, string? lang = null) => Task.CompletedTask;
        public Task SendEmailWithAttachmentAsync(string email, string subject, string htmlBody,
            byte[] attachmentBytes, string attachmentFileName, string attachmentContentType) => Task.CompletedTask;
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
