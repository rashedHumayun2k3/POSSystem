using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Branch_AddNullableColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "stock_movements",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "purchase_trips",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "purchase_receive_sessions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "petty_cash_boxes",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "lots",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "cartons",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StorageLocationId",
                table: "cartons",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_BranchId",
                table: "stock_movements",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_trips_BranchId",
                table: "purchase_trips",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_receive_sessions_BranchId",
                table: "purchase_receive_sessions",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_petty_cash_boxes_BranchId",
                table: "petty_cash_boxes",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_BranchId",
                table: "orders",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_BusinessId_BranchId_FulfillmentStatus",
                table: "orders",
                columns: new[] { "BusinessId", "BranchId", "FulfillmentStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_lots_BranchId",
                table: "lots",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_expenses_BranchId",
                table: "expenses",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_cartons_BranchId",
                table: "cartons",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_cartons_StorageLocationId",
                table: "cartons",
                column: "StorageLocationId");

            migrationBuilder.AddForeignKey(
                name: "FK_cartons_branches_BranchId",
                table: "cartons",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_cartons_storage_locations_StorageLocationId",
                table: "cartons",
                column: "StorageLocationId",
                principalTable: "storage_locations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_expenses_branches_BranchId",
                table: "expenses",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_lots_branches_BranchId",
                table: "lots",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_orders_branches_BranchId",
                table: "orders",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_petty_cash_boxes_branches_BranchId",
                table: "petty_cash_boxes",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_purchase_receive_sessions_branches_BranchId",
                table: "purchase_receive_sessions",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_purchase_trips_branches_BranchId",
                table: "purchase_trips",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_stock_movements_branches_BranchId",
                table: "stock_movements",
                column: "BranchId",
                principalTable: "branches",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cartons_branches_BranchId",
                table: "cartons");

            migrationBuilder.DropForeignKey(
                name: "FK_cartons_storage_locations_StorageLocationId",
                table: "cartons");

            migrationBuilder.DropForeignKey(
                name: "FK_expenses_branches_BranchId",
                table: "expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_lots_branches_BranchId",
                table: "lots");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_branches_BranchId",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "FK_petty_cash_boxes_branches_BranchId",
                table: "petty_cash_boxes");

            migrationBuilder.DropForeignKey(
                name: "FK_purchase_receive_sessions_branches_BranchId",
                table: "purchase_receive_sessions");

            migrationBuilder.DropForeignKey(
                name: "FK_purchase_trips_branches_BranchId",
                table: "purchase_trips");

            migrationBuilder.DropForeignKey(
                name: "FK_stock_movements_branches_BranchId",
                table: "stock_movements");

            migrationBuilder.DropIndex(
                name: "IX_stock_movements_BranchId",
                table: "stock_movements");

            migrationBuilder.DropIndex(
                name: "IX_purchase_trips_BranchId",
                table: "purchase_trips");

            migrationBuilder.DropIndex(
                name: "IX_purchase_receive_sessions_BranchId",
                table: "purchase_receive_sessions");

            migrationBuilder.DropIndex(
                name: "IX_petty_cash_boxes_BranchId",
                table: "petty_cash_boxes");

            migrationBuilder.DropIndex(
                name: "IX_orders_BranchId",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_BusinessId_BranchId_FulfillmentStatus",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_lots_BranchId",
                table: "lots");

            migrationBuilder.DropIndex(
                name: "IX_expenses_BranchId",
                table: "expenses");

            migrationBuilder.DropIndex(
                name: "IX_cartons_BranchId",
                table: "cartons");

            migrationBuilder.DropIndex(
                name: "IX_cartons_StorageLocationId",
                table: "cartons");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "stock_movements");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "purchase_trips");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "purchase_receive_sessions");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "petty_cash_boxes");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "cartons");

            migrationBuilder.DropColumn(
                name: "StorageLocationId",
                table: "cartons");
        }
    }
}
