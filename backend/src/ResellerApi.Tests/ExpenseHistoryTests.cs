using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Controllers;
using ResellerApi.Data;
using ResellerApi.DTOs.Expenses;
using ResellerApi.DTOs.Reports;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class ExpenseHistoryTests
{
    [Fact]
    public async Task HistoryAndReportIncludeExistingPaymentsOnceWithoutPostingMoney()
    {
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString(), o => o.EnableNullChecks(false)).Options, scope);
        var user = new User { Name = "Recorder" };
        var partner = new Partner { BusinessId = scope.CurrentBusinessId, Name = "Payer", LinkedUserId = user.Id };
        var category = new ExpenseCategory { BusinessId = scope.CurrentBusinessId, Name = "Office", Code = "OFFICE" };
        var trip = new PurchaseTrip { BusinessId = scope.CurrentBusinessId, BranchId = scope.CurrentBranchId, TripNo = "PO-TEST" };
        var lot = new PurchaseShipment { Trip = trip, LotNo = "LOT-TEST" };
        var cost = new PurchaseTripCost { Trip = trip, Shipment = lot, CostType = "SHIPPING_INTL", Amount = 780, Note = "Trip Go · AIR" };
        var shipping = new PurchasePayment { BusinessId = scope.CurrentBusinessId, BranchId = scope.CurrentBranchId, TripId = trip.Id, CostKey = cost.Id, Amount = 780,
            FundingSource = "PERSONAL", PartnerId = partner.Id, CreatedBy = user.Id, PaidAt = new DateTime(2026, 10, 31, 22, 23, 0, DateTimeKind.Utc) };
        var products = new PurchasePayment { BusinessId = scope.CurrentBusinessId, BranchId = scope.CurrentBranchId, TripId = trip.Id, CostKey = Guid.NewGuid(), Amount = 2000,
            FundingSource = "BUSINESS", CreatedBy = user.Id, PaidAt = new DateTime(2026, 11, 1, 5, 0, 0, DateTimeKind.Utc), Items = [new PurchasePaymentItem { PurchaseItemId = Guid.NewGuid(), Amount = 1200 }, new PurchasePaymentItem { PurchaseItemId = Guid.NewGuid(), Amount = 800 }] };
        db.AddRange(user, partner, category, trip, lot, cost, shipping, products,
            new Expense { BusinessId = scope.CurrentBusinessId, BranchId = scope.CurrentBranchId, Category = category, CreatedByUser = user, CreatedBy = user.Id, SubType = "Rent", Amount = 100, Status = "APPROVED", ExpenseDate = new DateTime(2026, 11, 1) },
            new PurchasePayment { BusinessId = Guid.NewGuid(), TripId = trip.Id, Amount = 9999, PaidAt = products.PaidAt },
            new PurchasePayment { BusinessId = scope.CurrentBusinessId, BranchId = Guid.NewGuid(), TripId = trip.Id, Amount = 8888, PaidAt = products.PaidAt });
        await db.SaveChangesAsync();
        var controller = new ReportsController(null!, null!, null!, db);
        var report = Assert.IsType<ExpenseReportDto>(Assert.IsType<OkObjectResult>(await controller.Expenses(new DateTime(2026,11,1),new DateTime(2026,11,1),null,"ALL")).Value);
        Assert.Equal(2880, report.ApprovedTotal);
        Assert.Equal(3, report.TotalItems);
        var row = Assert.Single(report.Items.Where(x => x.Id == shipping.Id));
        Assert.Equal("PO Shipping Cost", row.Title); Assert.Equal("Payer", row.PayerName); Assert.Equal("LOT-TEST", row.LotNo);
        Assert.Equal(2, report.Items.Count(x => x.Source == "PURCHASE_PAYMENT"));
        var filtered = Assert.IsType<ExpenseReportDto>(Assert.IsType<OkObjectResult>(await controller.Expenses(new DateTime(2026,11,1),new DateTime(2026,11,1),ExpenseHistory.ShippingCategory,"APPROVED")).Value);
        Assert.Equal(780, filtered.ApprovedTotal); Assert.Single(filtered.Items);
        var service = new ExpenseService(db, scope, null!);
        var first = await service.ListAsync(new(null,null,null,null,1,2,true));
        var second = await service.ListAsync(new(null,null,null,null,2,2,true));
        Assert.Equal(3, first.Total); Assert.Equal(3, first.Items.Concat(second.Items).Select(x=>x.Id).Distinct().Count());
        Assert.Single((await service.ListAsync(new(null,null,null,null,1,100))).Items);
        Assert.Single(db.Expenses); Assert.Empty(db.CapitalLedgerEntries); Assert.Empty(db.CapitalInjections);
    }

    [Fact]
    public void UnifiedQueryAndAggregatesTranslateToSqlServer()
    {
        var scope = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=localhost;Database=translation_only;Integrated Security=true;TrustServerCertificate=true").Options, scope);
        var query = ExpenseHistory.All(db).Where(x => x.ExpenseDate >= new DateTime(2026,11,1));
        Assert.Contains("UNION ALL", query.OrderByDescending(x=>x.ExpenseDate).ThenBy(x=>x.Id).Take(25).ToQueryString());
        Assert.Contains("SUM", query.GroupBy(x=>x.Status).Select(g=>new { Status=g.Key, Amount=g.Sum(x=>x.Amount) }).ToQueryString());
    }
}
