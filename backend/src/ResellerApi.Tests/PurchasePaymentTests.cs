using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Tests;
public class PurchasePaymentTests
{
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
        public BusinessContext Context = new() { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        public TestDb Db; public ExpenseFundingService Funding; public PurchasePaymentService Payments; public PurchaseTripService Trips;
        public Guid User = Guid.NewGuid(); public PurchaseTrip Trip; public PurchaseTripCost Cost; public Partner Partner;
        public Fixture()
        {
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Context);
            Funding = new(Db, Context); Payments = new(Db, Context, Funding); Trips = new(Db, Context, new Log());
            Trip = new() { BusinessId=Context.CurrentBusinessId, BranchId=Context.CurrentBranchId, TripNo="PO-1", SourceType="LOCAL_WHOLESALE", Status="PENDING_APPROVAL" };
            Cost = new() { TripId=Trip.Id, CostType="SHIPPING_INTL", Amount=200 };
            Partner = new() { BusinessId=Context.CurrentBusinessId, Name="Owner", LinkedUserId=User, Status="ACTIVE", PartnerType="MANAGING" };
        }
        public async Task Seed()
        {
            Db.PurchaseTrips.Add(Trip); Db.PurchaseTripCosts.Add(Cost); Db.Partners.Add(Partner);
            Db.PurchaseItems.Add(new PurchaseItem { TripId=Trip.Id, QtyBought=5, TotalCost=1000 });
            Db.CapitalInjections.Add(new CapitalInjection { BusinessId=Context.CurrentBusinessId, PartnerId=Partner.Id, PaidTo="Business", Status="APPROVED", AmountPaisa=200000, InjectedAt=DateTime.UtcNow });
            await Db.SaveChangesAsync();
        }
        public PurchasePaymentRequest Request(string source="BUSINESS") => new(Cost.Id, 200, source, Guid.NewGuid());
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }
    [Fact] public async Task BusinessPaymentDeductsOnceAndRetryIsIdempotent()
    {
        await using var f=new Fixture();await f.Seed();var request=f.Request();
        var first=await f.Payments.Pay(f.Trip.Id,request,f.User);var second=await f.Payments.Pay(f.Trip.Id,request,f.User);
        Assert.Equal(first.Id,second.Id);Assert.Equal(180000,await f.Funding.BalanceAsync());Assert.Empty(f.Db.Expenses);
        Assert.Single(await f.Payments.List(f.Trip.Id));
    }
    [Fact] public async Task DuplicateDifferentRequestRejected()
    {
        await using var f=new Fixture();await f.Seed();await f.Payments.Pay(f.Trip.Id,f.Request(),f.User);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Payments.Pay(f.Trip.Id,f.Request(),f.User));
        Assert.Single(f.Db.PurchasePayments);
    }
    [Fact] public async Task PersonalPaymentCreatesCapitalWithoutBusinessCash()
    {
        await using var f=new Fixture();await f.Seed();var p=await f.Payments.Pay(f.Trip.Id,f.Request("PERSONAL"),f.User);
        Assert.Equal(200000,await f.Funding.BalanceAsync());var entry=Assert.Single(f.Db.CapitalLedgerEntries);
        Assert.Equal(20000,entry.AmountPaisa);Assert.Equal(p.Id,entry.ReferenceId);Assert.Equal(f.Partner.Id,entry.PartnerId);
        Assert.Empty(f.Db.Expenses);
    }
    [Fact] public async Task PersonalPaymentRequiresLinkedPartner()
    {
        await using var f=new Fixture();await f.Seed();await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Payments.Pay(f.Trip.Id,f.Request("PERSONAL"),Guid.NewGuid()));
        Assert.Empty(f.Db.PurchasePayments);
    }
    [Fact] public async Task InsufficientBalanceAndChangedAmountRejected()
    {
        await using var f=new Fixture();await f.Seed();await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Payments.Pay(f.Trip.Id,f.Request() with {ExpectedAmount=201},f.User));
        f.Cost.Amount=3000;await f.Db.SaveChangesAsync();await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Payments.Pay(f.Trip.Id,f.Request() with {ExpectedAmount=3000},f.User));
        Assert.Empty(f.Db.PurchasePayments);
    }
    [Fact] public async Task TenantAndBranchIsolation()
    {
        await using var f=new Fixture();await f.Seed();var branch=f.Context.CurrentBranchId;
        f.Context.CurrentBranchId=Guid.NewGuid();await Assert.ThrowsAsync<KeyNotFoundException>(()=>f.Payments.Pay(f.Trip.Id,f.Request(),f.User));
        f.Context.CurrentBranchId=branch;f.Context.CurrentBusinessId=Guid.NewGuid();await Assert.ThrowsAsync<KeyNotFoundException>(()=>f.Payments.List(f.Trip.Id));
    }
    [Fact] public async Task CancelledAndPaidCostDeletionRejected()
    {
        await using var f=new Fixture();await f.Seed();await f.Payments.Pay(f.Trip.Id,f.Request(),f.User);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Trips.RemoveCostAsync(f.Trip.Id,f.Cost.Id,f.User));
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Trips.CancelAsync(f.Trip.Id,f.User));
        f.Trip.Status="CANCELLED";await f.Db.SaveChangesAsync();await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Payments.Pay(f.Trip.Id,new(Guid.Empty,1000,"BUSINESS",Guid.NewGuid()),f.User));
    }
    [Fact] public async Task ApprovalBlockedUntilPaymentsRecorded()
    {
        await using var f=new Fixture();await f.Seed();await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Trips.ApproveAsync(f.Trip.Id,null,f.User));
        await f.Payments.Pay(f.Trip.Id,new(Guid.Empty,1000,"BUSINESS",Guid.NewGuid()),f.User);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Trips.ApproveAsync(f.Trip.Id,null,f.User));
    }
    [Fact] public async Task ClosingIncludesPurchaseOutflowOnce()
    {
        await using var f=new Fixture();await f.Seed();var p=await f.Payments.Pay(f.Trip.Id,f.Request(),f.User);
        p.PaidAt=DateTime.UtcNow.Date.AddDays(-1);var injection=await f.Db.CapitalInjections.SingleAsync();injection.InjectedAt=p.PaidAt;await f.Db.SaveChangesAsync();
        await f.Funding.CloseAsync(p.PaidAt,null,f.User);Assert.Equal(180000,await f.Funding.BalanceAsync());
        Assert.Contains(f.Db.BusinessFundLedgerEntries,x=>x.SourceType=="PurchasePayment"&&x.AmountPaisa==-20000);
    }
}
