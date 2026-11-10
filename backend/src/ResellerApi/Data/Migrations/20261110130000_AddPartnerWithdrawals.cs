using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPartnerWithdrawals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "withdrawal_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PartnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    AmountPaisa = table.Column<long>(type: "bigint", nullable: false),
                    AvailableSnapshotPaisa = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RequestedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_withdrawal_requests", x => x.Id);
                    table.CheckConstraint("CK_withdrawal_requests_amount", "[AmountPaisa] > 0 AND [AmountPaisa] <= [AvailableSnapshotPaisa]");
                    table.ForeignKey(
                        name: "FK_withdrawal_requests_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_withdrawal_requests_partners_PartnerId",
                        column: x => x.PartnerId,
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_withdrawal_requests_BusinessId_RequestedAt",
                table: "withdrawal_requests",
                columns: new[] { "BusinessId", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_withdrawal_requests_BusinessId_RequestId",
                table: "withdrawal_requests",
                columns: new[] { "BusinessId", "RequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_withdrawal_requests_PartnerId",
                table: "withdrawal_requests",
                column: "PartnerId");

            // Cash Book: withdrawals become money out.
            foreach (var sql in DashboardReportSql.Batches("CashFlowWithdrawals.sql")) migrationBuilder.Sql(sql);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var sql in DashboardReportSql.Batches("CashActivityV2.sql").Where(s => s.Contains("FUNCTION dbo.CashFlowMovements"))) migrationBuilder.Sql(sql);
            migrationBuilder.DropTable(
                name: "withdrawal_requests");
        }
    }
}
