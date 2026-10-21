using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Features.BusinessBriefing;
using ResellerApi.Infrastructure;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace ResellerApi.Tests;
public class BusinessBriefingTests
{
    [Theory]
    [InlineData(0, "শূন্য টাকা")]
    [InlineData(10000, "দশ হাজার টাকা")]
    [InlineData(100000, "এক লাখ টাকা")]
    [InlineData(10000000, "এক কোটি টাকা")]
    [InlineData(-250, "ঋণাত্মক দুই শো পঞ্চাশ টাকা")]
    public void MoneyUsesBanglaWords(decimal amount, string expected) => Assert.Equal(expected, BanglaNarrative.Money(amount));
    [Fact] public void RoundingCarriesPaisa() => Assert.Equal("দুই টাকা", BanglaNarrative.Money(1.999m));
    [Fact] public void FractionUsesPaisa() => Assert.Equal("এক টাকা পঁচিশ পয়সা", BanglaNarrative.Money(1.25m));
    [Theory]
    [InlineData("2026-10-16T02:00:00Z", "2026-10-16", false)]
    [InlineData("2026-10-16T08:00:00Z", "2026-10-16", false)]
    [InlineData("2026-10-16T17:00:00Z", "2026-10-16", false)]
    [InlineData("2026-10-16T19:00:00Z", "2026-10-16", false)]
    public void OvernightBoundary(string now, string date, bool ended)
    {
        var p = BanglaNarrative.Period(DateTime.Parse(now).ToUniversalTime(), new(BusinessDayCutoffHour: 4));
        Assert.Equal(DateOnly.Parse(date), p.Date); Assert.Equal(ended, p.PeriodEnded);
    }
    [Fact] public void DstUsesBusinessZone()
    {
        var p = BanglaNarrative.Period(new DateTime(2026, 11, 1, 6, 30, 0, DateTimeKind.Utc), new(TimeZone: "America/New_York", BusinessDayCutoffHour: 4));
        Assert.Equal(new DateOnly(2026, 10, 31), p.Date);
    }
    [Fact] public void ZeroComparisonIsOmitted()
    {
        var m = EmptyMetrics();
        var segments = BanglaNarrative.Compose(m, new(new(2026, 10, 15), true, "গতকালের হিসাব"), "সব শাখা", "standard");
        Assert.DoesNotContain(segments, s => s.Id == "comparison");
        Assert.Contains(segments, s => s.Id == "sales" && s.Text == "এখন পর্যন্ত আজ কোনো বিক্রি হয়নি।");
        Assert.DoesNotContain(segments, s => s.Id == "closing");
    }
    [Fact] public void PartialDayComparisonIsOmittedEvenIfSupplied()
    {
        var metrics = EmptyMetrics() with { Sales = 1000, Orders = 2, PendingDeliveries = 4, PreviousSales = 500 };
        var segments = BanglaNarrative.Compose(metrics, new(new(2026, 10, 16), false, "শুক্রবার, ষোলো অক্টোবর"), "শাখা", "standard");
        Assert.Contains(segments, s => s.Id == "sales" && s.Text.Contains("পাঁচ শো টাকা বেশি"));
        Assert.Contains(segments, s => s.Id == "pending" && s.Text.Contains("চারটি"));
    }
    [Fact] public void SettingsRejectInvalidTimeZone() => Assert.Throws<ArgumentException>(() => BriefingService.Validate(new(TimeZone: "Invalid/Zone")));
    [Fact] public void EndpointRequiresFinancialReportRoles()
    {
        var authorization = (Microsoft.AspNetCore.Authorization.AuthorizeAttribute)Attribute.GetCustomAttribute(typeof(BriefingController), typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute))!;
        Assert.Equal(Roles.OwnerOrManager, authorization.Roles);
    }
    [Fact] public async Task LargerReportKeepsFinancialRoundingAcrossPages()
    {
        var business = Guid.NewGuid();
        var context = new BusinessContext { CurrentBusinessId = business };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, context);
        db.Businesses.Add(new Business { Id = business, Name = "Shop", Currency = "BDT" });
        for (int i = 0; i < 1001; i++) db.Orders.Add(new Order {
            BusinessId = business, BranchId = Guid.NewGuid(), OrderNo = "O" + i, Channel = "SHOP", CustomerName = "Hidden", CustomerPhone = "Hidden",
            BusinessDate = new(2026, 10, 16), DeliveryChargeCustomer = 10, DiscountType = "FIXED", DiscountValue = 2,
            IsDraft = i == 0, OrderStatus = i == 1 ? "CANCELLED" : "OPEN"
        });
        await db.SaveChangesAsync();
        var service = new BriefingService(db);
        var report = await service.Generate("quick", new DateTime(2026, 10, 16, 8, 0, 0, DateTimeKind.Utc), default);
        Assert.Equal(999, report.Metrics.Orders); Assert.Equal(7992, report.Metrics.Sales);
        Assert.True(report.Segments.Count < 10); Assert.DoesNotContain("Hidden", report.Transcript);
    }
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context) : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var e in ChangeTracker.Entries<BaseEntity>().Where(e => e.State is EntityState.Added or EntityState.Modified)) e.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }
    private static BriefingMetrics EmptyMetrics() => new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null);
    [Fact] public async Task ReportFiltersOtherTenantsAndBranches()
    {
        var business = Guid.NewGuid(); var branch = Guid.NewGuid();
        var context = new BusinessContext { CurrentBusinessId = business, CurrentBranchId = branch };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, context);
        db.Businesses.Add(new Business { Id = business, Name = "Shop", Currency = "BDT" });
        db.Branches.Add(new Branch { Id = branch, BusinessId = business, Name = "Selected", Code = "S" });
        Order Order(Guid tenant, Guid location, decimal delivery) => new() { BusinessId = tenant, BranchId = location,
            OrderNo = Guid.NewGuid().ToString(), Channel = "SHOP", CustomerName = "Private", CustomerPhone = "Private",
            BusinessDate = new(2026, 10, 16), DeliveryChargeCustomer = delivery };
        db.Orders.AddRange(Order(business, branch, 100), Order(Guid.NewGuid(), branch, 900), Order(business, Guid.NewGuid(), 800));
        await db.SaveChangesAsync();
        var service = new BriefingService(db);
        var report = await service.Generate("standard", new DateTime(2026, 10, 16, 8, 0, 0, DateTimeKind.Utc), default);
        Assert.Equal(100, report.Metrics.Sales); Assert.Equal(1, report.Metrics.Orders); Assert.Equal(1, report.Metrics.PendingDeliveries);
        Assert.DoesNotContain("Private", report.Transcript); Assert.Null(report.Metrics.PreviousSales);
    }
}
