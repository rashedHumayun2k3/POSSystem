using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Branch_MakeNonNullable_AddForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfill every existing row to its business's Main Branch before tightening
            // BranchId to NOT NULL below.
            migrationBuilder.Sql(@"
                UPDATE stock_movements SET BranchId = (SELECT Id FROM branches br WHERE br.BusinessId = stock_movements.BusinessId AND br.IsDefault = 1) WHERE BranchId IS NULL;
                UPDATE purchase_trips SET BranchId = (SELECT Id FROM branches br WHERE br.BusinessId = purchase_trips.BusinessId AND br.IsDefault = 1) WHERE BranchId IS NULL;
                UPDATE purchase_receive_sessions SET BranchId = (SELECT Id FROM branches br WHERE br.BusinessId = purchase_receive_sessions.BusinessId AND br.IsDefault = 1) WHERE BranchId IS NULL;
                UPDATE petty_cash_boxes SET BranchId = (SELECT Id FROM branches br WHERE br.BusinessId = petty_cash_boxes.BusinessId AND br.IsDefault = 1) WHERE BranchId IS NULL;
                UPDATE orders SET BranchId = (SELECT Id FROM branches br WHERE br.BusinessId = orders.BusinessId AND br.IsDefault = 1) WHERE BranchId IS NULL;
                UPDATE lots SET BranchId = (SELECT Id FROM branches br WHERE br.BusinessId = lots.BusinessId AND br.IsDefault = 1) WHERE BranchId IS NULL;
                UPDATE cartons SET BranchId = (SELECT Id FROM branches br WHERE br.BusinessId = cartons.BusinessId AND br.IsDefault = 1) WHERE BranchId IS NULL;
            ");

            migrationBuilder.DropIndex(
                name: "IX_petty_cash_boxes_BusinessId_StaffId",
                table: "petty_cash_boxes");

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "stock_movements",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "purchase_trips",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "purchase_receive_sessions",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "petty_cash_boxes",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "orders",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "lots",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "cartons",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_petty_cash_boxes_BusinessId_BranchId_StaffId",
                table: "petty_cash_boxes",
                columns: new[] { "BusinessId", "BranchId", "StaffId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_petty_cash_boxes_BusinessId_BranchId_StaffId",
                table: "petty_cash_boxes");

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "stock_movements",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "purchase_trips",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "purchase_receive_sessions",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "petty_cash_boxes",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "orders",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "lots",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "BranchId",
                table: "cartons",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.CreateIndex(
                name: "IX_petty_cash_boxes_BusinessId_StaffId",
                table: "petty_cash_boxes",
                columns: new[] { "BusinessId", "StaffId" },
                unique: true);
        }
    }
}
