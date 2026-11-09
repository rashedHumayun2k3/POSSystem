using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class DashboardCollectionsTests
{
    [Fact]
    public async Task TodayExpenseCountsApprovedExpensesAcrossFundingSourcesWithinScope()
    {
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, scope);
        var service = new ReportService(db);
        Assert.Equal(0, await service.GetDashboardTodayExpenseAsync());
        var empty = await service.GetDashboardExpenseSummaryAsync();
        Assert.Equal(0, empty.TodayCost); Assert.Equal(0, empty.MonthCost);
        var today = DhakaTime.UtcToLocal(DateTime.UtcNow).Date;
        Expense Expense(decimal amount, string source = "BUSINESS", string status = "APPROVED") => new() {
            BusinessId = scope.CurrentBusinessId, BranchId = scope.CurrentBranchId,
            Amount = amount, FundingSource = source, Status = status, ExpenseDate = today, SubType = "Test",
            RowVer = Guid.NewGuid().ToByteArray()
        };
        db.Expenses.AddRange(Expense(100), Expense(20, "PERSONAL"), Expense(30, "CASH"),
            Expense(999, status: "PENDING"), Expense(999, status: "CANCELLED"), Expense(999, status: "REJECTED"));
        var old = Expense(999); old.ExpenseDate = today.AddDays(-1); db.Add(old);
        var future = Expense(999); future.ExpenseDate = today.AddDays(1); db.Add(future);
        var lastMonth = Expense(888); lastMonth.ExpenseDate = new DateTime(today.Year, today.Month, 1).AddDays(-1); db.Add(lastMonth);
        var deleted = Expense(999); deleted.DeletedAt = DateTime.UtcNow; db.Add(deleted);
        var otherBusiness = Expense(999); otherBusiness.BusinessId = Guid.NewGuid(); db.Add(otherBusiness);
        var otherBranch = Expense(50); otherBranch.BranchId = Guid.NewGuid(); db.Add(otherBranch);
        await db.SaveChangesAsync();
        Assert.Equal(150, await service.GetDashboardTodayExpenseAsync());
        var summary = await service.GetDashboardExpenseSummaryAsync();
        Assert.Equal(150, summary.TodayCost);
        Assert.Equal(150 + (today.Day > 1 ? 999 : 0), summary.MonthCost);
        scope.CurrentBranchId = null;
        Assert.Equal(summary.MonthCost + 50, (await service.GetDashboardExpenseSummaryAsync()).MonthCost);
        Assert.Equal(200, await service.GetDashboardTodayExpenseAsync());
    }

    [Fact]
    public async Task CollectionsIncludeHistoricalRefundsAndIsolateBusinessAndBranch()
    {
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, scope);
        Order Sale(string method, decimal paid, decimal total = 100, bool returned = false)
        {
            var order = new Order { BusinessId = scope.CurrentBusinessId, BranchId = scope.CurrentBranchId,
                OrderNo = Guid.NewGuid().ToString(), Channel = "SHOP", CustomerName = "Test", CustomerPhone = "",
                FulfillmentStatus = returned ? "RETURNED" : "DELIVERED", CreatedAt = DateTime.UtcNow.AddYears(-1) };
            order.Items.Add(new OrderItem { OrderId = order.Id, Qty = 1, UnitPrice = total });
            order.Payments.Add(new OrderPayment { OrderId = order.Id, Method = method, Amount = paid });
            db.Orders.Add(order);
            return order;
        }
        var cash = Sale("CASH", 60); // 100 - 10% + 5 delivery - 60 paid = 35 due
        cash.CreatedAt = DateTime.UtcNow;
        cash.DiscountType = "PERCENT"; cash.DiscountValue = 10; cash.DeliveryChargeCustomer = 5;
        cash.Items.Add(new OrderItem { OrderId = cash.Id, Qty = 1, UnitPrice = 999, DeletedAt = DateTime.UtcNow });
        cash.Payments.Add(new OrderPayment { OrderId = cash.Id, Method = "CASH", Amount = 999, DeletedAt = DateTime.UtcNow });
        var returned = Sale("BKASH", 100, returned: true);
        returned.ReturnedAt = DateTime.UtcNow;
        returned.Payments.Add(new OrderPayment { OrderId = returned.Id, Method = "REFUND_CASH", Amount = -20 });
        returned.Payments.Add(new OrderPayment { OrderId = returned.Id, Method = "REFUND_BKASH", Amount = -80 });
        Sale("NAGAD", 100);
        Sale("CARD", 100);
        Sale("COD", 100); // Does not become physical cash.
        Sale("CASH", 999).IsDraft = true;
        Sale("CASH", 999).DeletedAt = DateTime.UtcNow;
        Sale("CASH", 999).BusinessId = Guid.NewGuid();
        Sale("CASH", 100).BranchId = Guid.NewGuid();
        foreach (var entry in db.ChangeTracker.Entries<BaseEntity>()) entry.Entity.RowVer = Guid.NewGuid().ToByteArray();
        await db.SaveChangesAsync();
        // SaveChanges stamps new rows with now; backdate the historical fixtures after insertion.
        foreach (var entry in db.ChangeTracker.Entries<Order>())
            if (entry.Entity.Id != cash.Id) entry.Entity.CreatedAt = DateTime.UtcNow.AddYears(-1);
        await db.SaveChangesAsync();
        var service = new ReportService(db);
        var result = await service.GetSalesCollectionsAsync();
        Assert.Equal(40, result.Cash);
        Assert.Equal(20, result.Bkash);
        Assert.Equal(100, result.Nagad);
        Assert.Equal(100, result.Card);
        Assert.Equal(35, await service.GetDashboardDueAsync());
        var grouped = await service.GetDashboardCollectionsSummaryAsync();
        Assert.Equal(40, grouped.Cash); Assert.Equal(35, grouped.Due);
        var overview = await service.GetDashboardSalesOverviewAsync(true);
        Assert.Equal(95, overview.TodaySales); Assert.Equal(95m, overview.TodayProfit);
        Assert.Equal(1, overview.TodayOrders); Assert.Equal(7, overview.Days.Count);
        Assert.Equal(95, overview.SevenDaySales); Assert.Null(overview.ChangePercent);
        Assert.Null((await service.GetDashboardSalesOverviewAsync(false)).TodayProfit);
        var financial = await service.GetDashboardFinancialSummaryAsync(true);
        Assert.Equal(95, financial.Sales); Assert.Equal(95m, financial.Profit);
        Assert.Null((await service.GetDashboardFinancialSummaryAsync(false)).Profit);
        var counts = await service.GetDashboardOrderSummaryAsync();
        Assert.Equal(1, counts.Orders); Assert.Equal(1, counts.Returns);
        scope.CurrentBranchId = null;
        Assert.Equal(140, (await service.GetSalesCollectionsAsync()).Cash);
    }
}
