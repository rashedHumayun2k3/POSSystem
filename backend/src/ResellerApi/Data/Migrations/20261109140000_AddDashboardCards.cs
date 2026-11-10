using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace ResellerApi.Data.Migrations;
[DbContext(typeof(AppDbContext))]
[Migration("20261109140000_AddDashboardCards")]
public partial class AddDashboardCards : Migration
{
 protected override void Up(MigrationBuilder migrationBuilder)
 { foreach(var sql in DashboardReportSql.Batches("DashboardCardsV2.sql")) migrationBuilder.Sql(sql); }
 protected override void Down(MigrationBuilder migrationBuilder)
 {
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardExpenseSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardCollectionSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardProfitSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardOrdersSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardProductsSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardCapitalSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardDuesSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardTopSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardCounterSection;");
  migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.DashboardTransitSection;");
  migrationBuilder.Sql("DROP FUNCTION IF EXISTS dbo.DashboardCardRange;");
 }
}
