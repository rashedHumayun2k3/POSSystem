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
        public Guid Reviewer = Guid.NewGuid();
        public Guid Category = Guid.NewGuid();
        public Fixture()
        {
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Business);
            Fund = new(Db, Business); Expenses = new(Db, Business, new Log());
            Db.Users.Add(new User { Id = User, Name = "Owner", Phone = "01700000000", PasswordHash = "test", Role = "OWNER" });
            Db.Users.Add(new User { Id = Reviewer, Name = "Reviewer", Phone = "01800000000", PasswordHash = "test", Role = "OWNER", IsActive = true });
            Db.ExpenseCategories.Add(new ExpenseCategory { Id = Category, BusinessId = Business.CurrentBusinessId, Code = "OFFICE", Name = "Office" });
        }
        public async Task<Partner> Seed(decimal? opening = 1000)
        {
            var partner = new Partner { BusinessId = Business.CurrentBusinessId, Name = "Owner partner", LinkedUserId = User, Status = "ACTIVE", PartnerType = "MANAGING" };
            Db.Partners.Add(partner); await Db.SaveChangesAsync();
            if (opening.HasValue) {
                Db.CapitalInjections.Add(new CapitalInjection { BusinessId = Business.CurrentBusinessId, PartnerId = partner.Id, PaidTo = "Business", AmountPaisa = (long)(opening.Value * 100), Status = "APPROVED" });
                await Db.SaveChangesAsync();
            }
            return partner;
        }
        public CreateExpenseRequest Request(string source = "BUSINESS", decimal amount = 100) => new(Category, "Rent", amount, DateTime.Today, null, false, null, null, null, null, null, null, source, Guid.NewGuid());
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    [Fact]
    public async Task CashSplitPersistsRetriesOnceAndDoesNotSpendCapital()
    {
        await using var f = new Fixture(); await f.Seed(0);
        var req = f.Request("CASH", 3000) with { CashPayments = new(2000, 700, 300) };
        var created = await f.Expenses.CreateAsync(req, f.User, true);
        Assert.Equal(req.CashPayments, created.CashPayments);
        Assert.Equal("CASH", created.FundingSource);
        Assert.Equal(0, await f.Fund.BalanceAsync());
        Assert.Equal(created.Id, (await f.Expenses.CreateAsync(req, f.User, true)).Id);
        Assert.Equal(1, await f.Db.Expenses.CountAsync());
        var listed = await f.Expenses.ListAsync(new(null, null, null, null, 1, 20));
        Assert.Equal(req.CashPayments, Assert.Single(listed.Items).CashPayments);
        var correction = new FinancialCorrectionService(f.Db, f.Business, new Log());
        await correction.CorrectAsync(created.Id, false, new(3500, false, created.UpdatedAt, CashPayments: new(2000, 1200, 300)), f.User, true);
        var updated = await f.Expenses.GetAsync(created.Id);
        Assert.Equal(new ExpenseCashPayments(2000, 1200, 300), updated.CashPayments);
        Assert.Equal(0, await f.Fund.BalanceAsync());
        await correction.CorrectAsync(created.Id, false, new(null, true, updated.UpdatedAt), f.User, true);
        Assert.Equal("CANCELLED", (await f.Expenses.GetAsync(created.Id)).Status);
        Assert.Equal(0, await f.Fund.BalanceAsync());
    }

    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(50, 20, 20)]
    [InlineData(-1, 101, 0)]
    [InlineData(50.001, 49.999, 0)]
    public async Task InvalidCashSplitsAreRejected(decimal cash, decimal bkash, decimal nagad)
    {
        await using var f = new Fixture(); await f.Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => f.Expenses.CreateAsync(
            f.Request("CASH") with { CashPayments = new(cash, bkash, nagad) }, f.User, true));
        Assert.Empty(f.Db.Expenses);
        Assert.Equal(100000, await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task CashSplitCannotBeMissingOrAttachedToAnotherFundingSource()
    {
        await using var f = new Fixture(); await f.Seed();
        await Assert.ThrowsAsync<ArgumentException>(() => f.Expenses.CreateAsync(f.Request("CASH"), f.User, true));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Expenses.CreateAsync(
            f.Request() with { CashPayments = new(100, 0, 0) }, f.User, true));
        var created = await f.Expenses.CreateAsync(f.Request("CASH") with { CashPayments = new(0, 100, 0) }, f.User, true);
        var correction = new FinancialCorrectionService(f.Db, f.Business, new Log());
        await Assert.ThrowsAsync<ArgumentException>(() => correction.CorrectAsync(created.Id, false, new(150, false, created.UpdatedAt), f.User, true));
        Assert.Equal(100, (await f.Expenses.GetAsync(created.Id)).Amount);
    }

    [Fact]
    public async Task ProductExpenseEditAndCancellationAdjustBusinessMoneyImmediately()
    {
        await using var f = new Fixture(); await f.Seed();
        var product = new Product { BusinessId = f.Business.CurrentBusinessId, Name = "Shoes", Sku = "SHOE" };
        f.Db.Products.Add(product); await f.Db.SaveChangesAsync();
        var balance = await f.Fund.BalanceAsync();
        var created = await f.Expenses.CreateAsync(f.Request() with { ProductId = product.Id }, f.User, true);
        Assert.Equal("APPROVED", created.Status);
        Assert.Equal(balance - 10000, await f.Fund.BalanceAsync());
        var correction = new FinancialCorrectionService(f.Db, f.Business, new Log());
        await correction.CorrectAsync(created.Id, false, new(150, false, created.UpdatedAt, "Corrected ad cost"), f.User, true);
        var updated = await f.Expenses.GetAsync(created.Id);
        Assert.Equal(150, updated.Amount); Assert.Equal("APPROVED", updated.Status);
        Assert.Equal(balance - 15000, await f.Fund.BalanceAsync());
        await correction.CorrectAsync(created.Id, false, new(null, true, updated.UpdatedAt), f.User, true);
        Assert.Equal("CANCELLED", (await f.Expenses.GetAsync(created.Id)).Status);
        Assert.Equal(balance, await f.Fund.BalanceAsync());
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ApprovedProductExpenseCorrectionAndCancellationRestoreBalance(bool solo)
    {
        await using var f = new Fixture(); await f.Seed();
        f.Db.BusinessUsers.Add(new BusinessUser { BusinessId = f.Business.CurrentBusinessId, UserId = f.User });
        if (!solo) f.Db.BusinessUsers.Add(new BusinessUser { BusinessId = f.Business.CurrentBusinessId, UserId = f.Reviewer });
        await f.Db.SaveChangesAsync();
        var product = new Product { BusinessId = f.Business.CurrentBusinessId, Name = "Shoes", Sku = "SHOE" };
        f.Db.Products.Add(product); await f.Db.SaveChangesAsync();
        var created = await f.Expenses.CreateAsync(f.Request() with { ProductId = product.Id }, f.User, true);
        var approved = await f.Expenses.GetAsync(created.Id);
        Assert.Equal("APPROVED", approved.Status);
        Assert.Equal(90000, await f.Fund.BalanceAsync());
        var correction = new FinancialCorrectionService(f.Db, f.Business, new Log());
        await correction.CorrectAsync(created.Id, false, new(150, false, approved.UpdatedAt), f.User, true);
        var edited = await f.Expenses.GetAsync(created.Id);
        Assert.Equal("APPROVED", edited.Status);
        Assert.Equal(85000, await f.Fund.BalanceAsync());
        Assert.Equal(85000, await f.Fund.BalanceAsync());
        edited = await f.Expenses.GetAsync(created.Id);
        await correction.CorrectAsync(created.Id, false, new(null, true, edited.UpdatedAt), f.User, true);
        Assert.Equal("CANCELLED", (await f.Expenses.GetAsync(created.Id)).Status);
        Assert.Equal(100000, await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task ProductExpenseCreatesOneLinkedEntryAndRetryIsIdempotent()
    {
        await using var f = new Fixture(); await f.Seed();
        var product = new Product { BusinessId = f.Business.CurrentBusinessId, Name = "Shoes", Sku = "SHOE" };
        f.Db.Products.Add(product); await f.Db.SaveChangesAsync();
        var request = f.Request() with { ProductId = product.Id };
        var created = await f.Expenses.CreateAsync(request, f.User, true);
        Assert.Equal(product.Id, (await f.Db.Expenses.SingleAsync()).ProductId);
        Assert.Equal(created.Id, (await f.Expenses.CreateAsync(request, f.User, true)).Id);
        Assert.Single(f.Db.Expenses); Assert.Empty(f.Db.StockMovements);
    }
    [Fact]
    public async Task ProductExpenseRejectsOtherBusinessProductBeforeCreatingExpense()
    {
        await using var f = new Fixture(); await f.Seed();
        var product = new Product { BusinessId = Guid.NewGuid(), Name = "Other", Sku = "OTHER" };
        f.Db.Products.Add(product); await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Expenses.CreateAsync(f.Request() with { ProductId = product.Id }, f.User, true));
        Assert.Empty(f.Db.Expenses);
        await Assert.ThrowsAsync<ArgumentException>(() => f.Expenses.CreateAsync(f.Request() with { ProductId = product.Id, AllocateToTripId = Guid.NewGuid() }, f.User, true));
    }

    [Fact]
    public async Task ExpenseTitleAndAmountCorrectionRequiresFreshReview()
    {
        await using var f = new Fixture(); await f.Seed();
        var created = await f.Expenses.CreateAsync(f.Request() with { Title = "New lock and fan" }, f.User, true);
        Assert.Equal("New lock and fan", created.Title);
        var approved = await f.Expenses.GetAsync(created.Id);
        await new FinancialCorrectionService(f.Db, f.Business, new ActivityLogService(f.Db))
            .CorrectAsync(created.Id, false, new(120, false, approved.UpdatedAt, "New lock"), f.User, false);
        var corrected = await f.Expenses.GetAsync(created.Id);
        Assert.Equal("New lock", corrected.Title);
        Assert.Equal(120, corrected.Amount);
        Assert.Equal("APPROVED", corrected.Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.ApproveAsync(created.Id, f.User, null));
        Assert.Equal(88000L, await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task BalanceUsesApprovedCashInvestmentsAcrossBusinessWithoutOpening()
    {
        await using var f = new Fixture(); await f.Seed(null);
        f.Db.CapitalInjections.Add(new CapitalInjection { BusinessId = f.Business.CurrentBusinessId, PartnerId = Guid.NewGuid(), PaidTo = "Old", AmountPaisa = 900000, Status = "APPROVED" });
        f.Db.CapitalInjections.Add(new CapitalInjection { BusinessId = Guid.NewGuid(), PaidTo = "Other business", AmountPaisa = 500000, Status = "APPROVED" });
        await f.Db.SaveChangesAsync();
        Assert.Equal(900000L, await f.Fund.BalanceAsync());
        f.Db.CapitalInjections.Add(new CapitalInjection { BusinessId = f.Business.CurrentBusinessId, PaidTo = "New", AmountPaisa = 5000, Status = "APPROVED" });
        await f.Db.SaveChangesAsync();
        Assert.Equal(905000L, await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task BusinessPaymentDebitsExactlyOnceAndDoesNotChangePartnerCapital()
    {
        await using var f = new Fixture(); await f.Seed(); var req = f.Request(amount: 125.25m);
        var first = await f.Expenses.CreateAsync(req, f.User, true);
        Assert.Equal("APPROVED", first.Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.ApproveAsync(first.Id, f.User, null));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.RejectAsync(first.Id, f.User, "Self reject"));
        var retry = await f.Expenses.CreateAsync(req, f.User, true);
        Assert.Equal(first.Id, retry.Id);
        Assert.Equal(87475L, await f.Fund.BalanceAsync());
        Assert.Empty(f.Db.CapitalLedgerEntries);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.CreateAsync(req with { Amount = 10 }, f.User, true));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.DeleteAsync(first.Id, f.User));
    }

    [Fact]
    public async Task EveryPaymentDebitsImmediatelyAndNextEntryRechecksFunds()
    {
        await using var f = new Fixture(); await f.Seed(100);
        var first = await f.Expenses.CreateAsync(f.Request(amount: 80), f.User, false);
        Assert.Equal("APPROVED", first.Status);
        Assert.Equal(2000L, await f.Fund.BalanceAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.CreateAsync(f.Request(amount: 30), f.User, true));
        Assert.Equal(2000L, await f.Fund.BalanceAsync()); Assert.Single(f.Db.Expenses);
    }

    [Fact]
    public async Task PersonalPaymentImmediatelyCreatesApprovedInvestmentWithoutAddingCash()
    {
        await using var f = new Fixture(); var partner = await f.Seed();
        var req = f.Request("PERSONAL", 120.50m);
        var expense = await f.Expenses.CreateAsync(req, f.User, false);
        var injection = Assert.Single(f.Db.CapitalInjections.Where(i => i.ExpenseId != null));
        Assert.Equal(expense.Id, injection.ExpenseId);
        Assert.Equal(partner.Id, injection.PartnerId);
        Assert.Equal(12050, injection.AmountPaisa);
        Assert.Equal("APPROVED", injection.Status);
        var capitalService = new PartnerCapitalService(f.Db, f.Business, new Log());
        await Assert.ThrowsAsync<InvalidOperationException>(() => capitalService.CastInjectionApprovalVoteAsync(partner.Id, injection.Id, new("APPROVE", null), f.User));
        Assert.Empty(f.Db.CapitalInjectionApprovalVotes);
        Assert.Equal(100000L, await f.Fund.BalanceAsync());
        injection.Status = "APPROVED"; await f.Db.SaveChangesAsync();
        Assert.Equal(100000L, await f.Fund.BalanceAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.ApproveAsync(expense.Id, f.Reviewer, null));
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
        Assert.Single(f.Db.CapitalInjections.Where(i => i.ExpenseId != null));
        Assert.Equal(0L, await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task MissingOpeningInsufficientBalanceAndPrecisionAreRejected()
    {
        await using var f = new Fixture(); await f.Seed(null);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.CreateAsync(f.Request(), f.User, true));
        Assert.Equal(0L, await f.Fund.BalanceAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.CreateAsync(f.Request(), f.User, true));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Expenses.CreateAsync(f.Request(amount: 0.001m), f.User, true));
        Assert.Empty(f.Db.Expenses);
    }

    [Fact]
    public async Task BalanceIncludesAllBranchesButHidesAmountsFromStaff()
    {
        await using var f = new Fixture(); await f.Seed();
        f.Business.CurrentBranchId = Guid.NewGuid();
        var expense = await f.Expenses.CreateAsync(f.Request(amount: 100), f.User, true);
        f.Business.CurrentBranchId = Guid.NewGuid();
        Assert.Equal(90000L, await f.Fund.BalanceAsync());
        var dto = await f.Fund.GetAsync(f.User, false, false);
        Assert.True(dto.Initialized); Assert.Null(dto.Balance); Assert.False(dto.CanInitialize);
    }

    [Fact]
    public async Task NewCapitalImmediatelyApprovesAndIncreasesFunds()
    {
        await using var f = new Fixture(); var partner = await f.Seed(null);
        f.Db.Partners.Add(new Partner { BusinessId = f.Business.CurrentBusinessId,
            Name = "Other manager", PartnerType = "MANAGING", Status = "ACTIVE", LinkedUserId = f.Reviewer });
        await f.Db.SaveChangesAsync();
        var service = new PartnerCapitalService(f.Db, f.Business, new Log());
        var request = new ResellerApi.DTOs.Partners.CreateCapitalInjectionRequest(
            500000, DateTime.Today, 0, "CASH", partner.Name, null, null, null, null, null, null, true);
        var result = await service.RecordInjectionAsync(partner.Id, request, f.User);
        Assert.Equal("APPROVED", result.Status);
        var stored = Assert.Single(f.Db.CapitalInjections);
        Assert.Equal(f.User, stored.SubmittedBy);
        Assert.NotNull(stored.SubmittedAt);
        Assert.Equal(partner.Name, stored.PaidTo);
        Assert.Equal(500000L, await f.Fund.BalanceAsync());
    }

    [Fact]
    public async Task PartnershipInstallmentsApproveWithoutVotesAndCorrectionsPostOnlyTheDifference()
    {
        await using var f = new Fixture(); var partner = await f.Seed(null);
        f.Db.Partners.Add(new Partner { BusinessId = f.Business.CurrentBusinessId, Name = "Other", Status = "ACTIVE", PartnerType = "MANAGING", LinkedUserId = f.Reviewer });
        await f.Db.SaveChangesAsync();
        var service = new PartnerCapitalService(f.Db, f.Business, new Log());
        var injection = await service.RecordInjectionAsync(partner.Id,
            new(500000, DateTime.Today, 0, "CASH", "Recipient", null, null, null, null, null, null, false), f.User);
        Assert.Equal("APPROVED", injection.Status); Assert.Empty(f.Db.CapitalInjectionApprovalVotes);
        Assert.Equal(500000L, await f.Fund.BalanceAsync());
        var corrections = new FinancialCorrectionService(f.Db, f.Business, new Log());
        await corrections.CorrectAsync(injection.Id, true, new(4000, false, injection.UpdatedAt), f.User, true);
        var changed = await f.Db.CapitalInjections.SingleAsync();
        Assert.Equal("APPROVED", changed.Status); Assert.Equal(400000L, await f.Fund.BalanceAsync());
        Assert.Equal(400000L, await f.Db.CapitalLedgerEntries.SumAsync(l => l.AmountPaisa));
        await corrections.CorrectAsync(changed.Id, true, new(null, true, changed.UpdatedAt), f.User, true);
        Assert.Equal(0L, await f.Fund.BalanceAsync()); Assert.Equal(0L, await f.Db.CapitalLedgerEntries.SumAsync(l => l.AmountPaisa));
    }

    [Fact]
    public async Task PersonalExpenseCorrectionReversesAndRepostsCapitalAutomatically()
    {
        await using var f = new Fixture(); var partner = await f.Seed();
        f.Db.Partners.Add(new Partner { BusinessId = f.Business.CurrentBusinessId, Name = "Reviewer", LinkedUserId = f.Reviewer, Status = "ACTIVE", PartnerType = "MANAGING" });
        await f.Db.SaveChangesAsync();
        var expense = await f.Expenses.CreateAsync(f.Request("PERSONAL", 100), f.User, true);
        var injection = await f.Db.CapitalInjections.SingleAsync(i => i.ExpenseId == expense.Id);
        var capital = new PartnerCapitalService(f.Db, f.Business, new Log());
        Assert.Equal("APPROVED", injection.Status);
        Assert.Equal(10000L, (await capital.GetBalanceAsync(partner.Id)).CapitalBalancePaisa);
        var correction = new FinancialCorrectionService(f.Db, f.Business, new ActivityLogService(f.Db));
        var oldVersion = injection.UpdatedAt;
        await correction.CorrectAsync(injection.Id, true, new(80, false, oldVersion), f.User, false);
        Assert.Equal(8000, injection.AmountPaisa);
        Assert.Equal("APPROVED", injection.Status);
        Assert.Equal(80, (await f.Expenses.GetAsync(expense.Id)).Amount);
        Assert.Equal("APPROVED", (await f.Expenses.GetAsync(expense.Id)).Status);
        Assert.Equal(8000L, (await capital.GetBalanceAsync(partner.Id)).CapitalBalancePaisa);
        Assert.Equal(3, await f.Db.CapitalLedgerEntries.CountAsync());
        Assert.Empty(f.Db.CapitalInjectionApprovalVotes);
        await Assert.ThrowsAsync<InvalidOperationException>(() => correction.CorrectAsync(injection.Id, true, new(70, false, oldVersion), f.User, false));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Expenses.ApproveAsync(expense.Id, f.User, null));
        Assert.Equal("APPROVED", injection.Status);
        Assert.Equal(8000L, (await capital.GetBalanceAsync(partner.Id)).CapitalBalancePaisa);
        await correction.CorrectAsync(injection.Id, true, new(null, true, injection.UpdatedAt), f.User, false);
        Assert.Equal("CANCELLED", injection.Status);
        Assert.Equal("CANCELLED", (await f.Expenses.GetAsync(expense.Id)).Status);
        Assert.Equal(0L, (await capital.GetBalanceAsync(partner.Id)).CapitalBalancePaisa);
        Assert.Equal(100000L, await f.Fund.BalanceAsync());
        Assert.Equal(4, await f.Db.CapitalLedgerEntries.CountAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => correction.CorrectAsync(injection.Id, true, new(null, true, injection.UpdatedAt), f.User, false));
        Assert.Equal(4, await f.Db.CapitalLedgerEntries.CountAsync());
    }

    [Fact]
    public async Task BusinessExpenseCancellationRestoresFundsAndPreservesHistory()
    {
        await using var f = new Fixture(); await f.Seed();
        var expense = await f.Expenses.CreateAsync(f.Request(amount: 100), f.User, true);
        Assert.Equal(90000L, await f.Fund.BalanceAsync());
        var row = await f.Db.Expenses.SingleAsync();
        var correction = new FinancialCorrectionService(f.Db, f.Business, new ActivityLogService(f.Db));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => correction.CorrectAsync(row.Id, false, new(null, true, row.UpdatedAt), Guid.NewGuid(), false));
        await correction.CorrectAsync(row.Id, false, new(null, true, row.UpdatedAt), f.User, false);
        Assert.Equal(100000L, await f.Fund.BalanceAsync());
        Assert.Null(row.DeletedAt);
        Assert.Equal("CANCELLED", row.Status);
        Assert.Single(f.Db.ActivityLogs);
    }

    [Fact]
    public async Task CorrectionsRejectClosedPeriodsAndOtherBusinesses()
    {
        await using var f = new Fixture(); await f.Seed();
        var expense = await f.Expenses.CreateAsync(f.Request(), f.User, true);
        var row = await f.Db.Expenses.SingleAsync();
        var correction = new FinancialCorrectionService(f.Db, f.Business, new Log());
        var business = f.Business.CurrentBusinessId;
        f.Business.CurrentBusinessId = Guid.NewGuid();
        await Assert.ThrowsAsync<KeyNotFoundException>(() => correction.CorrectAsync(row.Id, false, new(80, false, row.UpdatedAt), f.User, true));
        f.Business.CurrentBusinessId = business;
        f.Db.AccountingPeriodClosings.Add(new AccountingPeriodClosing { BusinessId = business, PeriodEnd = DateTime.Today, ClosedBy = f.Reviewer });
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => correction.CorrectAsync(row.Id, false, new(80, false, row.UpdatedAt), f.User, true));
        Assert.Equal(100, row.Amount);
        Assert.True((await f.Expenses.GetAsync(row.Id)).IsAccountingPeriodClosed);
        var expenses = await f.Expenses.ListAsync(new(null, null, null, null, 1, 100));
        Assert.True(Assert.Single(expenses.Items).IsAccountingPeriodClosed);
        var capital = new PartnerCapitalService(f.Db, f.Business, new Log());
        var partner = await f.Db.Partners.SingleAsync();
        Assert.True(Assert.Single(await capital.ListInjectionsAsync(partner.Id)).IsAccountingPeriodClosed);
        var future = new CapitalInjection { BusinessId = business, PartnerId = partner.Id, CreatedBy = f.User,
            PaidTo = "Future", InjectedAt = DateTime.Today.AddDays(1), AmountPaisa = 1000 };
        f.Db.CapitalInjections.Add(future);
        await f.Db.SaveChangesAsync();
        Assert.False((await capital.ListInjectionsAsync(partner.Id)).Single(i => i.Id == future.Id).IsAccountingPeriodClosed);
        // A future installment is still locked when its linked expense belongs to a closed period.
        future.ExpenseId = row.Id;
        await f.Db.SaveChangesAsync();
        Assert.True((await capital.ListInjectionsAsync(partner.Id)).Single(i => i.Id == future.Id).IsAccountingPeriodClosed);
        var openExpense = await f.Expenses.CreateAsync(f.Request("PERSONAL") with { ExpenseDate = DateTime.Today.AddDays(1) }, f.User, true);
        Assert.False(openExpense.IsAccountingPeriodClosed);

    }

    [Theory]
    [InlineData("OWNER", "BUSINESS")]
    [InlineData("OWNER", "PERSONAL")]
    [InlineData("PARTNER", "BUSINESS")]
    [InlineData("PARTNER", "PERSONAL")]
    public async Task SoleOwnerOrManagingPartnerAutoApprovesCosts(string role, string source)
    {
        await using var f = new Fixture(); var partner = await f.Seed();
        (await f.Db.Users.SingleAsync(u => u.Id == f.User)).Role = role;
        f.Db.BusinessUsers.Add(new BusinessUser { BusinessId = f.Business.CurrentBusinessId, UserId = f.User });
        await f.Db.SaveChangesAsync();
        var request = f.Request(source, 100);
        var result = await f.Expenses.CreateAsync(request, f.User, role == "OWNER");
        Assert.Equal("APPROVED", result.Status);
        Assert.Equal(f.User, result.ApprovedBy);
        if (source == "PERSONAL") {
            var injection = await f.Db.CapitalInjections.SingleAsync(i => i.ExpenseId == result.Id);
            Assert.Equal("APPROVED", injection.Status);
            Assert.Equal(10000L, (await f.Db.CapitalLedgerEntries.SingleAsync()).AmountPaisa);
            await f.Expenses.CreateAsync(request, f.User, role == "OWNER");
            Assert.Single(f.Db.CapitalLedgerEntries);
        }
        Assert.Equal(source == "PERSONAL" ? 100000L : 90000L, await f.Fund.BalanceAsync());
        await new FinancialCorrectionService(f.Db, f.Business, new ActivityLogService(f.Db))
            .CorrectAsync(result.Id, false, new(80, false, result.UpdatedAt), f.User, role == "OWNER");
        Assert.Equal("APPROVED", (await f.Expenses.GetAsync(result.Id)).Status);
        Assert.Equal(source == "PERSONAL" ? 100000L : 92000L, await f.Fund.BalanceAsync());
        if (source == "PERSONAL") Assert.Equal(8000L, await f.Db.CapitalLedgerEntries.SumAsync(l => l.AmountPaisa));
    }

    [Fact]
    public async Task AllAuthorizedExpenseEntriesAutoApproveRegardlessOfPartnerCount()
    {
        await using var f = new Fixture(); var partner = await f.Seed();
        f.Db.BusinessUsers.AddRange(new BusinessUser { BusinessId = f.Business.CurrentBusinessId, UserId = f.User },
            new BusinessUser { BusinessId = f.Business.CurrentBusinessId, UserId = f.Reviewer });
        await f.Db.SaveChangesAsync();
        Assert.Equal("APPROVED", (await f.Expenses.CreateAsync(f.Request(), f.User, true)).Status);
        f.Db.BusinessUsers.Remove(await f.Db.BusinessUsers.SingleAsync(b => b.UserId == f.Reviewer));
        (await f.Db.Users.SingleAsync(u => u.Id == f.User)).Role = "PARTNER";
        partner.PartnerType = "SLEEPING";
        await f.Db.SaveChangesAsync();
        Assert.Equal("APPROVED", (await f.Expenses.CreateAsync(f.Request(), f.User, false)).Status);
        partner.PartnerType = "MANAGING";
        f.Db.Partners.Add(new Partner { BusinessId = f.Business.CurrentBusinessId, Name = "Other member", Status = "ACTIVE", PartnerType = "SLEEPING" });
        await f.Db.SaveChangesAsync();
        Assert.Equal("APPROVED", (await f.Expenses.CreateAsync(f.Request(), f.User, false)).Status);
    }

    [Fact]
    public async Task InstallmentsAlwaysApproveEvenWhenLegacySubmitFlagIsFalse()
    {
        await using var f = new Fixture(); var partner = await f.Seed(null);
        var service = new PartnerCapitalService(f.Db, f.Business, new Log());
        var request = new ResellerApi.DTOs.Partners.CreateCapitalInjectionRequest(
            500000, DateTime.Today, 0, "CASH", "To Business", null, null, null, null, null, null, false);
        var first = await service.RecordInjectionAsync(partner.Id, request, f.User);
        Assert.Equal("APPROVED", first.Status);
        Assert.Equal(500000L, await f.Fund.BalanceAsync());
        Assert.Equal(500000L, await f.Db.CapitalLedgerEntries.SumAsync(e => e.AmountPaisa));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SubmitInjectionForApprovalAsync(partner.Id, first.Id, f.User));
        Assert.Single(f.Db.CapitalLedgerEntries);
    }

    [Fact]
    public async Task CapitalBalanceSeparatesCashAndPersonallyPaidExpensesAfterCorrections()
    {
        await using var f = new Fixture(); var partner = await f.Seed(null);
        f.Db.Partners.Add(new Partner { BusinessId = f.Business.CurrentBusinessId,
            Name = "Reviewer partner", LinkedUserId = f.Reviewer, Status = "ACTIVE", PartnerType = "MANAGING" });
        await f.Db.SaveChangesAsync();
        var capital = new PartnerCapitalService(f.Db, f.Business, new Log());
        var cash = await capital.RecordInjectionAsync(partner.Id,
            new(2_000_000, DateTime.Today, 0, "CASH", "To Business", null, null, null, null, null, null, true), f.User);
        var expense = await f.Expenses.CreateAsync(f.Request("PERSONAL", 2000), f.User, false);
        var personal = await f.Db.CapitalInjections.SingleAsync(i => i.ExpenseId == expense.Id);
        Assert.Equal("APPROVED", personal.Status);
        var balance = await capital.GetBalanceAsync(partner.Id);
        Assert.Equal(2_000_000, balance.CashInstallmentsPaisa);
        Assert.Equal(200_000, balance.PersonalExpensesPaisa);
        Assert.Equal(2_200_000, balance.CapitalBalancePaisa);
        Assert.Equal(0, balance.OtherCapitalPaisa);
        await new FinancialCorrectionService(f.Db, f.Business, new ActivityLogService(f.Db))
            .CorrectAsync(personal.Id, true, new(null, true, personal.UpdatedAt), f.User, false);
        balance = await capital.GetBalanceAsync(partner.Id);
        Assert.Equal(2_000_000, balance.CashInstallmentsPaisa);
        Assert.Equal(0, balance.PersonalExpensesPaisa);
        Assert.Equal(balance.CapitalBalancePaisa,
            balance.CashInstallmentsPaisa + balance.PersonalExpensesPaisa + balance.OtherCapitalPaisa);
    }

    [Fact]
    public async Task ListingLegacyPendingInvestmentsDoesNotMigrateOldData()
    {
        await using var f = new Fixture(); await f.Seed();
        f.Db.Partners.Add(new Partner { BusinessId = f.Business.CurrentBusinessId,
            Name = "Reviewer", LinkedUserId = f.Reviewer, Status = "ACTIVE", PartnerType = "MANAGING" });
        await f.Db.SaveChangesAsync();
        var expense = await f.Expenses.CreateAsync(f.Request("PERSONAL", 100), f.User, true);
        var injection = await f.Db.CapitalInjections.SingleAsync(i => i.ExpenseId == expense.Id);
        f.Db.CapitalLedgerEntries.RemoveRange(f.Db.CapitalLedgerEntries.Where(l => l.ReferenceId == injection.Id));
        injection.Status = "PENDING_APPROVAL";
        injection.ApprovedAt = null;
        injection.ApprovedBy = null;
        await f.Db.SaveChangesAsync();

        var capital = new PartnerCapitalService(f.Db, f.Business, new Log());
        Assert.Single(await capital.ListPendingInjectionsAsync());
        Assert.Equal("PENDING_APPROVAL", injection.Status);
        Assert.Empty(f.Db.CapitalLedgerEntries.Where(l => l.ReferenceId == injection.Id));
    }

}
