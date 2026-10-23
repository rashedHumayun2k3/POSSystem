using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseItemPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PurchaseItemId",
                table: "purchase_payments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_payments_PurchaseItemId",
                table: "purchase_payments",
                column: "PurchaseItemId");

            migrationBuilder.AddForeignKey(
                name: "FK_purchase_payments_purchase_items_PurchaseItemId",
                table: "purchase_payments",
                column: "PurchaseItemId",
                principalTable: "purchase_items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_purchase_payments_purchase_items_PurchaseItemId",
                table: "purchase_payments");

            migrationBuilder.DropIndex(
                name: "IX_purchase_payments_PurchaseItemId",
                table: "purchase_payments");

            migrationBuilder.DropColumn(
                name: "PurchaseItemId",
                table: "purchase_payments");
        }
    }
}
