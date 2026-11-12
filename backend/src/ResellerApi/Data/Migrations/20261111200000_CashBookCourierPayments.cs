using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace ResellerApi.Data.Migrations;

// Money received from couriers (COD remittances) now counts in the Cash Book wallets.
[DbContext(typeof(AppDbContext))]
[Migration("20261111200000_CashBookCourierPayments")]
public partial class CashBookCourierPayments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        foreach (var sql in DashboardReportSql.Batches("CashFlowCard.sql").Where(s => s.Contains("FUNCTION dbo.CashFlowMovements")))
            migrationBuilder.Sql(sql);
    }

    protected override void Down(MigrationBuilder migrationBuilder) { }
}
