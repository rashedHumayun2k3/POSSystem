using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using ResellerApi.Data;
using ResellerApi.DTOs.Feedback;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

public class FeedbackServiceTests
{
    // Same InMemory RowVer-backfill workaround used elsewhere in this test project (InMemory
    // doesn't auto-populate rowversion columns the way SQL Server does).
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

    private static FeedbackService NewService(AppDbContext db) => new(db);

    private static (Company Company, Business Business, User Owner) SeedBusiness(AppDbContext db, string businessName)
    {
        var company = new Company { Name = $"{businessName} Co" };
        db.Companies.Add(company);
        var business = new Business { CompanyId = company.Id, Name = businessName, Currency = "BDT" };
        db.Businesses.Add(business);
        var owner = new User
        {
            CompanyId = company.Id,
            Name = "Owner of " + businessName,
            Phone = Guid.NewGuid().ToString("N")[..11],
            PasswordHash = "x",
            Role = Roles.Owner,
            IsActive = true
        };
        db.Users.Add(owner);
        return (company, business, owner);
    }

    [Fact]
    public async Task CreateAsync_PersistsFeedbackWithNoReply()
    {
        var db = NewDb();
        var (_, business, owner) = SeedBusiness(db, "Shop A");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var result = await sut.CreateAsync(business.Id, owner.Id, new CreateFeedbackRequest("Subject", "Details", null));

        Assert.Equal("Subject", result.Subject);
        Assert.Equal("Details", result.Details);
        Assert.Null(result.Reply);
        Assert.Equal(owner.Name, result.SubmittedByName);
    }

    [Fact]
    public async Task CreateAsync_EmptySubject_Throws()
    {
        var db = NewDb();
        var (_, business, owner) = SeedBusiness(db, "Shop A");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.CreateAsync(business.Id, owner.Id, new CreateFeedbackRequest("", "Details", null)));
    }

    [Fact]
    public async Task ListForBusinessAsync_NoReply_ShowsAsUnanswered()
    {
        var db = NewDb();
        var (_, business, owner) = SeedBusiness(db, "Shop A");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        await sut.CreateAsync(business.Id, owner.Id, new CreateFeedbackRequest("Subject", "Details", null));

        var list = await sut.ListForBusinessAsync(business.Id);

        Assert.Single(list);
        Assert.Null(list[0].Reply);
    }

    [Fact]
    public async Task ReplyAsync_ThenList_ShowsAsAnswered()
    {
        var db = NewDb();
        var (_, business, owner) = SeedBusiness(db, "Shop A");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var created = await sut.CreateAsync(business.Id, owner.Id, new CreateFeedbackRequest("Subject", "Details", null));
        await sut.ReplyAsync(created.Id, "admin", new ReplyToFeedbackRequest("Thanks for the feedback!"));

        var list = await sut.ListForBusinessAsync(business.Id);

        Assert.Single(list);
        Assert.NotNull(list[0].Reply);
        Assert.Equal("Thanks for the feedback!", list[0].Reply!.Body);
        Assert.Equal("admin", list[0].Reply!.RepliedByUsername);
    }

    [Fact]
    public async Task ReplyAsync_EmptyBody_Throws()
    {
        var db = NewDb();
        var (_, business, owner) = SeedBusiness(db, "Shop A");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        var created = await sut.CreateAsync(business.Id, owner.Id, new CreateFeedbackRequest("Subject", "Details", null));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.ReplyAsync(created.Id, "admin", new ReplyToFeedbackRequest("  ")));
    }

    [Fact]
    public async Task ReplyAsync_UnknownFeedback_ThrowsNotFound()
    {
        var db = NewDb();
        var sut = NewService(db);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            sut.ReplyAsync(Guid.NewGuid(), "admin", new ReplyToFeedbackRequest("Hi")));
    }

    [Fact]
    public async Task ListForBusinessAsync_OnlyReturnsOwnBusinessFeedback()
    {
        var db = NewDb();
        var (_, businessA, ownerA) = SeedBusiness(db, "Shop A");
        var (_, businessB, ownerB) = SeedBusiness(db, "Shop B");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        await sut.CreateAsync(businessA.Id, ownerA.Id, new CreateFeedbackRequest("From A", "Details", null));
        await sut.CreateAsync(businessB.Id, ownerB.Id, new CreateFeedbackRequest("From B", "Details", null));

        var listA = await sut.ListForBusinessAsync(businessA.Id);

        Assert.Single(listA);
        Assert.Equal("From A", listA[0].Subject);
    }

    [Fact]
    public async Task ListAllAsync_ReturnsFeedbackAcrossAllBusinesses()
    {
        var db = NewDb();
        var (_, businessA, ownerA) = SeedBusiness(db, "Shop A");
        var (_, businessB, ownerB) = SeedBusiness(db, "Shop B");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        await sut.CreateAsync(businessA.Id, ownerA.Id, new CreateFeedbackRequest("From A", "Details", null));
        await sut.CreateAsync(businessB.Id, ownerB.Id, new CreateFeedbackRequest("From B", "Details", null));

        var all = await sut.ListAllAsync(null);

        Assert.Equal(2, all.Count);
        Assert.Contains(all, f => f.BusinessName == "Shop A" && f.Subject == "From A");
        Assert.Contains(all, f => f.BusinessName == "Shop B" && f.Subject == "From B");
    }

    [Fact]
    public async Task ListAllAsync_SearchFiltersBySubjectOrBusinessName()
    {
        var db = NewDb();
        var (_, businessA, ownerA) = SeedBusiness(db, "Shop A");
        var (_, businessB, ownerB) = SeedBusiness(db, "Shop B");
        await db.SaveChangesAsync();

        var sut = NewService(db);
        await sut.CreateAsync(businessA.Id, ownerA.Id, new CreateFeedbackRequest("Login issue", "Details", null));
        await sut.CreateAsync(businessB.Id, ownerB.Id, new CreateFeedbackRequest("Payment issue", "Details", null));

        var results = await sut.ListAllAsync("Login");

        Assert.Single(results);
        Assert.Equal("Login issue", results[0].Subject);
    }
}
