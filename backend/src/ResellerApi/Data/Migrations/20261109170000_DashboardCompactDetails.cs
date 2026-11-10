using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace ResellerApi.Data.Migrations;
[DbContext(typeof(AppDbContext))]
[Migration("20261109170000_DashboardCompactDetails")]
public partial class DashboardCompactDetails : Migration
{
 protected override void Up(MigrationBuilder migrationBuilder)
 { foreach(var sql in DashboardReportSql.Batches("DashboardCompactDetails.sql")) migrationBuilder.Sql(sql); }
 protected override void Down(MigrationBuilder migrationBuilder)
 {
  foreach(var sql in DashboardReportSql.Batches("DashboardCardsV2.sql").Where(s=>new[]{"Expense","Orders","Products","Dues","Top"}.Any(n=>s.Contains("PROCEDURE dbo.Dashboard"+n+"Section")))) migrationBuilder.Sql(sql);
  foreach(var sql in DashboardReportSql.Batches("DashboardSalesSection.sql")) migrationBuilder.Sql(sql);
 }
}
