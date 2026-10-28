using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Controllers;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;
using System.Text.Json;
namespace ResellerApi.Tests;
public class ProductExpenseTests
{
    private sealed class Log : IActivityLogService
    {
        public Task LogAsync(Guid businessId, Guid userId, string action, string entityType, Guid? entityId = null, object? before = null, object? after = null) => Task.CompletedTask;
    }
    private sealed class Fixture : IAsyncDisposable
    {
        public BusinessContext Scope = new() { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        public AppDbContext Db;
        public Product Product;
        public Expense Expense;
        public ProductExpensesController Controller;
        public Fixture()
        {
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, Scope);
            Product = new() { BusinessId = Scope.CurrentBusinessId, Name = "Shoes", Sku = "SHOE" };
            Expense = new() { BusinessId = Scope.CurrentBusinessId, SubType = "Facebook Ads", Title = "Shoe campaign", Amount = 500, Status = "APPROVED", ExpenseDate = DateTime.UtcNow };
            Db.Products.Add(Product); Db.Expenses.Add(Expense);
            Controller = new(Db, Scope, new CurrentUserService(new HttpContextAccessor()), new Log());
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }
    [Fact] public async Task LinkingDoesNotDuplicateExpenseAndUnlinkPreservesIt()
    {
        await using var f = new Fixture(); await f.Db.SaveChangesAsync();
        Assert.IsType<NoContentResult>(await f.Controller.Link(f.Product.Id, f.Expense.Id));
        Assert.Equal(f.Product.Id, f.Expense.ProductId);
        Assert.IsType<NoContentResult>(await f.Controller.Link(f.Product.Id, f.Expense.Id));
        Assert.Single(f.Db.Expenses.IgnoreQueryFilters()); Assert.Equal(500, f.Expense.Amount);
        Assert.Empty(f.Db.StockMovements); Assert.Empty(f.Db.CapitalLedgerEntries);
        Assert.IsType<NoContentResult>(await f.Controller.Unlink(f.Product.Id, f.Expense.Id));
        Assert.Null(f.Expense.ProductId); Assert.Single(f.Db.Expenses.IgnoreQueryFilters());
    }
    [Fact] public async Task NewlyCreatedPendingExpenseIsVisibleOnProduct()
    {
        await using var f = new Fixture(); f.Expense.ProductId = f.Product.Id; f.Expense.Status = "PENDING"; await f.Db.SaveChangesAsync();
        var result = Assert.IsType<OkObjectResult>(await f.Controller.List(f.Product.Id));
        Assert.Equal(1, JsonSerializer.SerializeToElement(result.Value).GetProperty("total").GetInt32());
    }
    [Fact] public async Task CannotLinkExpenseToTwoProducts()
    {
        await using var f = new Fixture(); await f.Db.SaveChangesAsync();
        f.Expense.ProductId = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        Assert.IsType<ConflictObjectResult>(await f.Controller.Link(f.Product.Id, f.Expense.Id));
    }
    [Theory]
    [InlineData("PENDING", false)] [InlineData("REJECTED", false)] [InlineData("APPROVED", true)]
    public async Task ExcludesUnapprovedAndPoAllocatedExpenses(string status, bool allocated)
    {
        await using var f = new Fixture(); f.Expense.Status = status; if (allocated) f.Expense.AllocateToTripId = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        Assert.IsType<ConflictObjectResult>(await f.Controller.Link(f.Product.Id, f.Expense.Id));
        var result = Assert.IsType<OkObjectResult>(await f.Controller.List(f.Product.Id, available: true));
        Assert.Equal(0, JsonSerializer.SerializeToElement(result.Value).GetProperty("total").GetInt32());
    }
    [Fact] public async Task SearchIncludesSharedExpensesButNotOtherBusinessesOrBranches()
    {
        await using var f = new Fixture();
        f.Db.Expenses.Add(new Expense { BusinessId = Guid.NewGuid(), SubType = "Facebook Ads", Amount = 100 });
        f.Db.Expenses.Add(new Expense { BusinessId = f.Scope.CurrentBusinessId, BranchId = Guid.NewGuid(), SubType = "Facebook Ads", Amount = 100 });
        await f.Db.SaveChangesAsync();
        var result = Assert.IsType<OkObjectResult>(await f.Controller.List(f.Product.Id, available:true, search:"Shoe"));
        Assert.Equal(1, JsonSerializer.SerializeToElement(result.Value).GetProperty("total").GetInt32());
        f.Expense.BusinessId = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        Assert.IsType<NotFoundResult>(await f.Controller.Link(f.Product.Id, f.Expense.Id));
        f.Product.BusinessId = Guid.NewGuid(); await f.Db.SaveChangesAsync();
        Assert.IsType<NotFoundResult>(await f.Controller.List(f.Product.Id));
    }
}
