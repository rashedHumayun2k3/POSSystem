using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace ResellerApi.Data.Migrations;
[DbContext(typeof(AppDbContext))]
[Migration("20261109160000_RestrictDashboardProfitPeriods")]
public partial class RestrictDashboardProfitPeriods : Migration
{
 protected override void Up(MigrationBuilder migrationBuilder)
 { foreach(var sql in DashboardReportSql.Batches("DashboardProfitPeriods.sql")) migrationBuilder.Sql(sql); }
 protected override void Down(MigrationBuilder migrationBuilder)
 { foreach(var sql in DashboardReportSql.Batches("DashboardCardsV2.sql").Where(s=>s.Contains("PROCEDURE dbo.DashboardProfitSection"))) migrationBuilder.Sql(sql); }
}
