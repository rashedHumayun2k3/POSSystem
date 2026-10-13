using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Expenses;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Tests;

public class ExpenseFundingTests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context) : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var e in ChangeTracker.Entries<BaseEntity>())
                if (e.State == EntityState.Added) e.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }
    private sealed class Log : IActivityLogService
    {
        public Task LogAsync(Guid businessId, Guid userId, string action, string entityType, Guid? entityId = null, object? before = null, object? after = null) => Task.CompletedTask;
    }
    private sealed class Fixture : IAsyncDisposable
    {
        public BusinessContext Business = new() { CurrentBusinessId = Guid.NewGuid() };
        public TestDb Db;
        public ExpenseFundingService Fund;
        public ExpenseService Expenses;
        public Guid User = Guid.NewGuid();
        public Guid Category = Guid.NewGuid();
        public Fixture()
        {
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Business);
            Fund = new(Db, Business); Expenses = new(Db, Business, new Log());
            Db.Users.Add(new User { Id = User, Name = "Owner", Phone = "01700000000", PasswordHash = "test", Role = "OWNER" });
            Db.ExpenseCategories.Add(new ExpenseCategory { Id = Category, BusinessId = Business.CurrentBusinessId, Code = "OFFICE", Name = "Office" });
        }
        public async Task<Partner> Seed(decimal? opening = 1000)
        {
            var partner = new Partner { BusinessId = Business.CurrentBusinessId, Name = "Owner partner", LinkedUserId = User, Status = "ACTIVE", PartnerType = "MANAGING" };
            Db.Partners.Add(partner); await Db.SaveChangesAsync();
            if (opening.HasValue) await Fund.InitializeAsync(opening.Value, User);
            return partner;
        }
        public CreateExpenseRequest Request(string source = "BUSINESS", decimal amount = 100) => new(Category, "Rent", amount, DateTime.Today, null, false, null, null, null, null, null, null, source, Guid.NewGuid());
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    [Fact]
    public async Task OpeningIsExactAndOneTimeAndBusinessScoped()
    {
        await using var f = new Fixture(); await f.Seed(null);
        f.Db.CapitalInjections.Add(new CapitalInjection { BusinessId = f.Business.CurrentBusinessId, PartnerId = Guid.NewGuid(), PaidTo = "Old", AmountPaisa = 900000, Status = "APPROVED" });
        f.Db.CapitalInjections.Add(new CapitalInjection { BusinessId = Guid.NewGuid(), PaidTo = "Other business", AmountPaisa = 500000, Status = "APPROVED" });
        await f.Db.SaveChangesAsync();
        await f.Fund.InitializeAsync(200, f.User);
        Assert.Equal(20000L, await f.Fund.BalanceAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Fund.InitializeAsync(900, f.User));
        f.Db.CapitalInjections.Add(new CapitalInjection { BusinessId = f.Business.CurrentBusinessId, PaidTo = "New", AmountPaisa = 5000, Status = "APPROVED" });
        await f.Db.SaveChangesAsync();
        Assert.Equal(25000L, await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task BusinessPaymentDebitsExactlyOnceAndDoesNotChangePartnerCapital()
    {
        await using var f = new Fixture(); await f.Seed(); var req = f.Request(amount: 125.25m);
        var first = await f.Expenses.CreateAsync(req, f.User, true);
        var retry = await f.Expenses.CreateAsync(req, f.User, true);
        Assert.Equal(first.Id, retry.Id);
        Assert.Equal(87475L, await f.Fund.BalanceAsync());
        Assert.Empty(f.Db.CapitalLedgerEntries);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.CreateAsync(req with { Amount = 10 }, f.User, true));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.DeleteAsync(first.Id, f.User));
    }

    [Fact]
    public async Task PendingPaymentDebitsOnlyOnApprovalAndRechecksFunds()
    {
        await using var f = new Fixture(); await f.Seed(100);
        var pending = await f.Expenses.CreateAsync(f.Request(amount: 80), f.User, false);
        Assert.Equal(10000L, await f.Fund.BalanceAsync());
        await f.Expenses.CreateAsync(f.Request(amount: 30), f.User, true);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.ApproveAsync(pending.Id, f.User, null));
        Assert.Equal(7000L, await f.Fund.BalanceAsync());
        await f.Expenses.RejectAsync(pending.Id, f.User, "Insufficient capital");
        Assert.Equal(7000L, await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task PersonalPaymentCreatesLinkedInvestmentAfterExpenseApprovalWithoutAddingCash()
    {
        await using var f = new Fixture(); var partner = await f.Seed();
        var req = f.Request("PERSONAL", 120.50m);
        var expense = await f.Expenses.CreateAsync(req, f.User, false);
        Assert.Empty(f.Db.CapitalInjections);
        await f.Expenses.ApproveAsync(expense.Id, f.User, null);
        var injection = Assert.Single(f.Db.CapitalInjections);
        Assert.Equal(expense.Id, injection.ExpenseId);
        Assert.Equal(partner.Id, injection.PartnerId);
        Assert.Equal(12050, injection.AmountPaisa);
        Assert.Equal("PENDING_APPROVAL", injection.Status);
        Assert.Equal(100000L, await f.Fund.BalanceAsync());
        injection.Status = "APPROVED"; await f.Db.SaveChangesAsync();
        Assert.Equal(100000L, await f.Fund.BalanceAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.ApproveAsync(expense.Id, f.User, null));
    }

    [Fact]
    public async Task PersonalPaymentRequiresOwnActiveLinkedPartnerAndDoesNotRequireOpening()
    {
        await using var f = new Fixture(); var partner = await f.Seed(null);
        partner.LinkedUserId = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.CreateAsync(f.Request("PERSONAL"), f.User, true));
        partner.LinkedUserId = f.User; await f.Db.SaveChangesAsync();
        var expense = await f.Expenses.CreateAsync(f.Request("PERSONAL"), f.User, true);
        Assert.Equal("Owner partner", expense.FundingPartnerName);
        Assert.Single(f.Db.CapitalInjections);
        Assert.Null(await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task MissingOpeningInsufficientBalanceAndPrecisionAreRejected()
    {
        await using var f = new Fixture(); await f.Seed(null);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.CreateAsync(f.Request(), f.User, true));
        await f.Fund.InitializeAsync(1, f.User);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.CreateAsync(f.Request(), f.User, true));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Expenses.CreateAsync(f.Request(amount: 0.001m), f.User, true));
        Assert.Empty(f.Db.Expenses);
    }

    [Fact]
    public async Task BalanceIncludesAllBranchesButHidesAmountsFromStaff()
    {
        await using var f = new Fixture(); await f.Seed();
        f.Business.CurrentBranchId = Guid.NewGuid();
        await f.Expenses.CreateAsync(f.Request(amount: 100), f.User, true);
        f.Business.CurrentBranchId = Guid.NewGuid();
        Assert.Equal(90000L, await f.Fund.BalanceAsync());
        var dto = await f.Fund.GetAsync(f.User, false, false);
        Assert.True(dto.Initialized); Assert.Null(dto.Balance); Assert.False(dto.CanInitialize);
    }
}
