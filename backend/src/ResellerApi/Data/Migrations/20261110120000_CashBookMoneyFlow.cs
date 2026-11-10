using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace ResellerApi.Data.Migrations;
// Report procedures only; no tables or columns change.
[DbContext(typeof(AppDbContext))]
[Migration("20261110120000_CashBookMoneyFlow")]
public class CashBookMoneyFlow : Migration
{
 protected override void Up(MigrationBuilder migrationBuilder)
 { foreach(var sql in DashboardReportSql.Batches("CashActivityV2.sql")) migrationBuilder.Sql(sql); }
 protected override void Down(MigrationBuilder migrationBuilder)
 {
  foreach(var sql in DashboardReportSql.Batches("CashActivity.sql")) migrationBuilder.Sql(sql);
  foreach(var sql in DashboardReportSql.Batches("DashboardCurrentMoney.sql")) migrationBuilder.Sql(sql);
  migrationBuilder.Sql("DROP FUNCTION IF EXISTS dbo.CashFlowMovements;");
 }
}
