using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace ResellerApi.Data.Migrations;

// Damaged units are never added to OnHand, so Available = OnHand - Committed.
// Re-applies the dashboard procedures that used to subtract Damaged a second time.
[DbContext(typeof(AppDbContext))]
[Migration("20261111100000_AvailableStockExcludesDamagedOnce")]
public partial class AvailableStockExcludesDamagedOnce : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        foreach (var sql in DashboardReportSql.Batches("DashboardCompactDetails.sql").Where(s => s.Contains("PROCEDURE dbo.DashboardProductsSection")))
            migrationBuilder.Sql(sql);
        foreach (var sql in DashboardReportSql.Batches().Where(s => s.Contains("PROCEDURE dbo.DashboardStock")))
            migrationBuilder.Sql(sql);
    }

    protected override void Down(MigrationBuilder migrationBuilder) { }
}
