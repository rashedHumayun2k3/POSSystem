using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Controllers;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Tests;

public class ExpenseReviewTests
{
    private sealed class Fixture : IAsyncDisposable
    {
        public BusinessContext Scope = new() { CurrentBusinessId = Guid.NewGuid() };
        public AppDbContext Db;
        public Guid A = Guid.NewGuid(), B = Guid.NewGuid(), C = Guid.NewGuid();
        public Expense Expense;
        public Fixture()
        {
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, Scope);
            foreach (var id in new[] { A, B, C }) {
                Db.Users.Add(new User { Id = id, Name = id.ToString() });
                Db.Partners.Add(new Partner { BusinessId = Scope.CurrentBusinessId, LinkedUserId = id, Name = id.ToString(), Status = "ACTIVE", PartnerType = "MANAGING" });
            }
            Expense = new Expense { BusinessId = Scope.CurrentBusinessId, CreatedBy = A, SubType = "Facebook Ads", Amount = 300, Status = "APPROVED", ExpenseDate = DateTime.Today };
            Db.Expenses.Add(Expense);
        }
        public ExpenseReviewsController Controller(Guid user) => new(Db, Scope, new CurrentUserService(new HttpContextAccessor {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, user.ToString()) }, "test")) }
        }));
        public async Task<int> Count(Guid user) => JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(await Controller(user).List()).Value).GetProperty("total").GetInt32();
        public Task<IActionResult> Seen(Guid user, int? version = null) => Controller(user).MarkSeen(new(new() { new(Expense.Id, version ?? Expense.ReviewVersion) }));
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    [Fact] public async Task DocumentAttachmentPreservesPaymentAndRequiresFreshReview()
    {
        await using var f = new Fixture(); await f.Db.SaveChangesAsync();
        await f.Seen(f.B);
        var user = new CurrentUserService(new HttpContextAccessor { HttpContext = new DefaultHttpContext {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, f.A.ToString()) }, "test")) } });
        var controller = new ExpensesController(null!, user, new ResellerApi.Services.ExpenseFundingService(f.Db, f.Scope));
        var url = $"/uploads/{f.Scope.CurrentBusinessId}/{Guid.NewGuid()}.pdf";
        Assert.IsType<OkObjectResult>(await controller.AttachDocument(f.Expense.Id, new(url), f.Db, f.Scope));
        Assert.Equal(url, f.Expense.PhotoUrl);
        Assert.Equal(300, f.Expense.Amount);
        Assert.Equal("APPROVED", f.Expense.Status);
        Assert.Empty(f.Db.CapitalLedgerEntries);
        var version = f.Expense.ReviewVersion;
        Assert.IsType<OkObjectResult>(await controller.AttachDocument(f.Expense.Id, new(url), f.Db, f.Scope));
        Assert.Equal(version, f.Expense.ReviewVersion);
        Assert.IsType<BadRequestObjectResult>(await controller.AttachDocument(f.Expense.Id, new($"/uploads/{Guid.NewGuid()}/{Guid.NewGuid()}.pdf"), f.Db, f.Scope));
        Assert.Equal(url, f.Expense.PhotoUrl);
        Assert.Equal(1, await f.Count(f.B));
        var otherUser = new CurrentUserService(new HttpContextAccessor { HttpContext = new DefaultHttpContext {
            User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, f.B.ToString()) }, "test")) } });
        var other = new ExpensesController(null!, otherUser, new ResellerApi.Services.ExpenseFundingService(f.Db, f.Scope));
        Assert.IsType<ForbidResult>(await other.AttachDocument(f.Expense.Id, new(url), f.Db, f.Scope));
    }

    [Fact] public async Task EachPartnerAcknowledgesIndependentlyWithoutChangingMoney()
    {
        await using var f = new Fixture(); await f.Db.SaveChangesAsync();
        Assert.Equal(0, await f.Count(f.A)); Assert.Equal(1, await f.Count(f.B)); Assert.Equal(1, await f.Count(f.C));
        Assert.IsType<NoContentResult>(await f.Seen(f.B));
        Assert.IsType<NoContentResult>(await f.Seen(f.B));
        Assert.Equal(0, await f.Count(f.B)); Assert.Equal(1, await f.Count(f.C));
        Assert.Single(f.Db.ExpenseReviews);
        Assert.IsType<NoContentResult>(await f.Seen(f.C)); Assert.Equal(0, await f.Count(f.C));
        Assert.Equal("APPROVED", f.Expense.Status); Assert.Equal(300, f.Expense.Amount);
        Assert.Empty(f.Db.CapitalLedgerEntries); Assert.Empty(f.Db.CapitalInjections);
    }

    [Fact] public async Task EditedAndCancelledEntriesNeedFreshAcknowledgementAndRejectStaleChecks()
    {
        await using var f = new Fixture(); await f.Db.SaveChangesAsync();
        await f.Seen(f.B); var oldVersion = f.Expense.ReviewVersion;
        f.Expense.Amount = 200; await f.Db.SaveChangesAsync();
        Assert.True(f.Expense.ReviewVersion > oldVersion); Assert.Equal(1, await f.Count(f.B));
        Assert.IsType<ConflictObjectResult>(await f.Seen(f.B, oldVersion));
        await f.Seen(f.B); Assert.Equal(0, await f.Count(f.B));
        f.Expense.Status = "CANCELLED"; await f.Db.SaveChangesAsync();
        Assert.Equal(1, await f.Count(f.B)); await f.Seen(f.B); Assert.Equal(0, await f.Count(f.B));
    }

    [Fact] public async Task SoloBusinessesOwnEntriesAndOtherBusinessEntriesCannotBeAcknowledged()
    {
        await using var f = new Fixture(); await f.Db.SaveChangesAsync();
        Assert.IsType<NotFoundResult>(await f.Seen(f.A));
        Assert.IsType<ForbidResult>(await f.Seen(Guid.NewGuid()));
        f.Expense.BusinessId = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        Assert.Equal(0, await f.Count(f.B)); Assert.IsType<NotFoundResult>(await f.Seen(f.B));
        f.Expense.BusinessId = f.Scope.CurrentBusinessId;
        foreach (var p in f.Db.Partners.Where(p => p.LinkedUserId != f.B)) p.Status = "INACTIVE";
        await f.Db.SaveChangesAsync();
        Assert.Equal(0, await f.Count(f.B)); Assert.IsType<ForbidResult>(await f.Seen(f.B));
    }

    [Fact] public async Task BranchFilterAndPendingEntriesAreRespected()
    {
        await using var f = new Fixture(); f.Scope.CurrentBranchId = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        Assert.Equal(1, await f.Count(f.B));
        f.Expense.BranchId = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        Assert.Equal(0, await f.Count(f.B)); Assert.IsType<NotFoundResult>(await f.Seen(f.B));
        f.Expense.BranchId = f.Scope.CurrentBranchId; f.Expense.Status = "PENDING"; await f.Db.SaveChangesAsync();
        Assert.Equal(0, await f.Count(f.B)); Assert.IsType<NotFoundResult>(await f.Seen(f.B));
    }
}
