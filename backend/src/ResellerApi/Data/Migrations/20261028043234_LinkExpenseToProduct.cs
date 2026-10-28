using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class LinkExpenseToProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProductId",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_expenses_ProductId",
                table: "expenses",
                column: "ProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_expenses_products_ProductId",
                table: "expenses",
                column: "ProductId",
                principalTable: "products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_expenses_products_ProductId",
                table: "expenses");

            migrationBuilder.DropIndex(
                name: "IX_expenses_ProductId",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "expenses");
        }
    }
}
