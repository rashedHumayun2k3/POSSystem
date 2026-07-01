using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCourierRemittance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodRemittanceStatus",
                table: "orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RemittanceId",
                table: "orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "courier_remittances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    RemittanceNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CourierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    RemittedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Method = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RecordedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_courier_remittances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_courier_remittances_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_courier_remittances_couriers_CourierId",
                        column: x => x.CourierId,
                        principalTable: "couriers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_courier_remittances_users_RecordedBy",
                        column: x => x.RecordedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_orders_RemittanceId",
                table: "orders",
                column: "RemittanceId");

            migrationBuilder.CreateIndex(
                name: "IX_courier_remittances_BusinessId_RemittanceNo",
                table: "courier_remittances",
                columns: new[] { "BusinessId", "RemittanceNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_courier_remittances_CourierId",
                table: "courier_remittances",
                column: "CourierId");

            migrationBuilder.CreateIndex(
                name: "IX_courier_remittances_RecordedBy",
                table: "courier_remittances",
                column: "RecordedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_orders_courier_remittances_RemittanceId",
                table: "orders",
                column: "RemittanceId",
                principalTable: "courier_remittances",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_courier_remittances_RemittanceId",
                table: "orders");

            migrationBuilder.DropTable(
                name: "courier_remittances");

            migrationBuilder.DropIndex(
                name: "IX_orders_RemittanceId",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "CodRemittanceStatus",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "RemittanceId",
                table: "orders");
        }
    }
}
