using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ResellerApi.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261109120000_AddDashboardStoredProcedures")]
public partial class AddDashboardStoredProcedures : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        foreach (var sql in DashboardReportSql.Batches()) migrationBuilder.Sql(sql);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var name in new[] { "DashboardSalesOverview", "DashboardOrders", "DashboardExpenses", "DashboardStock",
            "DashboardCollections", "DashboardTrend", "DashboardPaymentMethods", "DashboardTopProducts", "DashboardCategories", "DashboardHourly" })
            migrationBuilder.Sql($"DROP PROCEDURE IF EXISTS dbo.{name};");
        migrationBuilder.Sql("DROP FUNCTION IF EXISTS dbo.DashboardOrderAmounts;");
        migrationBuilder.Sql("DROP FUNCTION IF EXISTS dbo.DashboardRoundEven;");
    }
}
