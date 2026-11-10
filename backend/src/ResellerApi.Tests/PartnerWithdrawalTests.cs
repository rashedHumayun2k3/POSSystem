using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Tests;

public class PartnerWithdrawalTests
{
    [Fact]
    public async Task WithdrawalWritesNegativeCapitalRowEvenWhenCapitalIsLocked()
    {
        await using var f = new Fixture();
        f.Invest(100000, lockedMonths: 12); await f.Db.SaveChangesAsync();

        var w = await f.Service.WithdrawAsync(new(f.Partner.Id, "bkash", 30000, Guid.NewGuid(), " family "), f.User);

        Assert.Equal("family", w.Note); Assert.Equal("BKASH", w.Source);
        var entry = Assert.Single(f.Db.CapitalLedgerEntries, l => l.EntryType == "WITHDRAWAL");
        Assert.Equal(-30000, entry.AmountPaisa); Assert.Equal(70000, entry.BalanceAfterPaisa); Assert.Equal("CAPITAL", entry.Bucket);
        var saved = Assert.Single(f.Db.WithdrawalRequests);
        Assert.Equal("APPROVED", saved.Status); Assert.Equal("BKASH", saved.Source);
    }

    [Fact]
    public async Task InvalidInputIsRejectedAndNothingSaved()
    {
        await using var f = new Fixture(); await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<ArgumentException>(() => f.Service.WithdrawAsync(new(f.Partner.Id, "BANK", 100, Guid.NewGuid()), f.User));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Service.WithdrawAsync(new(f.Partner.Id, "CASH", 0, Guid.NewGuid()), f.User));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Service.WithdrawAsync(new(f.Partner.Id, "CASH", 100, Guid.Empty), f.User));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.WithdrawAsync(new(Guid.NewGuid(), "CASH", 100, Guid.NewGuid()), f.User));
        Assert.Empty(f.Db.WithdrawalRequests);
    }

    [Fact]
    public async Task RetryWithSameRequestIdSavesOnce()
    {
        await using var f = new Fixture(); await f.Db.SaveChangesAsync();
        var request = new CreateWithdrawalRequest(f.Partner.Id, "CARD", 20000, Guid.NewGuid());
        var first = await f.Service.WithdrawAsync(request, f.User);
        var second = await f.Service.WithdrawAsync(request, f.User);
        Assert.Equal(first.Id, second.Id);
        Assert.Single(f.Db.WithdrawalRequests);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.WithdrawAsync(request with { AmountPaisa = 1 }, f.User));
    }

    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context) : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            foreach (var e in ChangeTracker.Entries<BaseEntity>().Where(e => e.State == EntityState.Added)) e.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(ct);
        }
    }
    private sealed class Log : IActivityLogService
    {
        public Task LogAsync(Guid businessId, Guid userId, string action, string entityType, Guid? entityId = null, object? before = null, object? after = null) => Task.CompletedTask;
    }
    private sealed class Fixture : IAsyncDisposable
    {
        public BusinessContext Context = new() { CurrentBusinessId = Guid.NewGuid() };
        public TestDb Db; public PartnerWithdrawalService Service; public Partner Partner; public Guid User = Guid.NewGuid();
        public Fixture()
        {
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Context);
            Service = new(Db, Context, new Log());
            Partner = new Partner { BusinessId = Context.CurrentBusinessId, Name = "Rashed", PartnerType = "MANAGING", Status = "ACTIVE", LinkedUserId = User };
            Db.Partners.Add(Partner);
        }
        public void Invest(long paisa, int lockedMonths)
        {
            var now = DateTime.UtcNow;
            var injection = new CapitalInjection { BusinessId = Context.CurrentBusinessId, PartnerId = Partner.Id, AmountPaisa = paisa, PaidTo = "Shop",
                Status = "APPROVED", InjectedAt = now, LockInMonths = lockedMonths, LockInExpiresAt = now.AddMonths(lockedMonths) };
            Db.CapitalInjections.Add(injection);
            Db.CapitalLedgerEntries.Add(new CapitalLedgerEntry { BusinessId = Context.CurrentBusinessId, PartnerId = Partner.Id, EntryType = "CAPITAL_INJECTION",
                Bucket = "CAPITAL", AmountPaisa = paisa, ReferenceType = "CapitalInjection", ReferenceId = injection.Id });
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }
}
