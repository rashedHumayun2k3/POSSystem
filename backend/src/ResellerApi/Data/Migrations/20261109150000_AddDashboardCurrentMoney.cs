using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace ResellerApi.Data.Migrations;
[DbContext(typeof(AppDbContext))]
[Migration("20261109150000_AddDashboardCurrentMoney")]
public partial class AddDashboardCurrentMoney : Migration
{
 protected override void Up(MigrationBuilder migrationBuilder)
 { foreach(var sql in DashboardReportSql.Batches("DashboardCurrentMoney.sql")) migrationBuilder.Sql(sql); }
 protected override void Down(MigrationBuilder migrationBuilder)
 { migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardMoneySection;"); }
}
