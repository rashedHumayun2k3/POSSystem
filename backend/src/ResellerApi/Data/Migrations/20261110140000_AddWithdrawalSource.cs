using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWithdrawalSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "withdrawal_requests",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "CASH");

            // Card becomes a wallet; withdrawals leave the wallet they were taken from.
            foreach (var sql in DashboardReportSql.Batches("CashFlowCard.sql")) migrationBuilder.Sql(sql);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var sql in DashboardReportSql.Batches("CashFlowWithdrawals.sql")) migrationBuilder.Sql(sql);
            foreach (var sql in DashboardReportSql.Batches("CashActivityV2.sql").Where(s => !s.Contains("FUNCTION dbo.CashFlowMovements"))) migrationBuilder.Sql(sql);
            migrationBuilder.DropColumn(
                name: "Source",
                table: "withdrawal_requests");
        }
    }
}
