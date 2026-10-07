using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Partners;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class PartnerPosAccessTests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext business) : AppDbContext(options, business)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<BaseEntity>().Where(e => e.State is EntityState.Added or EntityState.Modified))
                entry.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, null)]
    [InlineData(false, null)]
    public async Task EditPersistsPermissionAndPreservesLinkedAccount(bool initial, bool? requested)
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, business);
        var user = new User { Name = "Partner", Phone = "01712345678", PasswordHash = "test", Role = Roles.Partner, IsActive = true, CanAccessPos = initial };
        var partner = new Partner { BusinessId = business.CurrentBusinessId, Name = "Partner", PartnerType = "MANAGING", LinkedUserId = user.Id, NidNumber = "123", Address = "Dhaka" };
        db.Users.Add(user);
        db.BusinessUsers.Add(new BusinessUser { BusinessId = business.CurrentBusinessId, UserId = user.Id });
        db.Partners.Add(partner);
        await db.SaveChangesAsync();
        var log = new ActivityLogService(db);
        var service = new PartnerService(db, business, log, new PartnerCapitalService(db, business, log));
        var request = new UpdatePartnerRequest("Updated", null, null, user.Id, "MANAGING", null, null, "123", "Dhaka", null, null, null, null, null, null, null, requested);
        var result = await service.UpdateAsync(partner.Id, request, Guid.NewGuid());
        db.ChangeTracker.Clear();
        Assert.Equal(requested ?? initial, (await db.Users.SingleAsync()).CanAccessPos);
        Assert.Equal(requested ?? initial, result.CanAccessPos);
        Assert.Equal(requested ?? initial, (await service.GetAsync(partner.Id)).CanAccessPos);
        Assert.Equal(user.Id, result.LinkedUserId);
    }
}
