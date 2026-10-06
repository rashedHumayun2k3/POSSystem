using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using Xunit;

namespace ResellerApi.Tests;

public class PriceSlotApplyTests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext business)
        : AppDbContext(options, business)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<BaseEntity>())
                if (entry.State == EntityState.Added && entry.Entity.RowVer is null)
                    entry.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ApplyScheduledOffer_PersistsDiscountAfterPriceReload(bool isDefault)
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new TestDb(options, business);
        var product = new Product { BusinessId = business.CurrentBusinessId, Name = "Test", Sku = "TEST", SellingPrice = 100m };
        var variant = new ProductVariant { BusinessId = business.CurrentBusinessId, Product = product, Sku = "TEST-V", Barcode = "TEST", IsDefault = isDefault };
        var original = new PriceSlot { BusinessId = business.CurrentBusinessId, Variant = variant, Label = "Original Price", Price = 100m, StartDate = DateTime.UtcNow.AddDays(-1), IsActive = true };
        var offer = new PriceSlot { BusinessId = business.CurrentBusinessId, Variant = variant, Label = "Offer 10%", Price = 90m, StartDate = DateTime.UtcNow.AddDays(1) };
        db.PriceSlots.AddRange(original, offer);
        await db.SaveChangesAsync();
        var service = new PriceSlotService(db, business);

        await service.ActivateSlotAsync(variant.Id, offer.Id, Guid.NewGuid());
        await service.EnsureScheduledStateAsync(variant.Id);

        Assert.True(offer.IsActive);
        Assert.False(original.IsActive);
        Assert.Equal(90m, variant.PriceOverride ?? product.SellingPrice);
        Assert.True(offer.StartDate <= DateTime.UtcNow);
    }
}
