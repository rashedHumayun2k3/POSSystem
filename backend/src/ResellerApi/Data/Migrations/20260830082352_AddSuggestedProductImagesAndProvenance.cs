using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSuggestedProductImagesAndProvenance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageSource",
                table: "suggested_products",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "COMMON");

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "suggested_products",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageSource",
                table: "products",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "INDIVIDUAL");

            migrationBuilder.AddColumn<Guid>(
                name: "SuggestedProductId",
                table: "products",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_suggested_products_ImageSource",
                table: "suggested_products",
                sql: "[ImageSource] IN ('COMMON', 'INDIVIDUAL')");

            migrationBuilder.CreateIndex(
                name: "IX_products_SuggestedProductId",
                table: "products",
                column: "SuggestedProductId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_products_ImageSource",
                table: "products",
                sql: "[ImageSource] IN ('COMMON', 'INDIVIDUAL')");

            migrationBuilder.AddForeignKey(
                name: "FK_products_suggested_products_SuggestedProductId",
                table: "products",
                column: "SuggestedProductId",
                principalTable: "suggested_products",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_products_suggested_products_SuggestedProductId",
                table: "products");

            migrationBuilder.DropCheckConstraint(
                name: "CK_suggested_products_ImageSource",
                table: "suggested_products");

            migrationBuilder.DropIndex(
                name: "IX_products_SuggestedProductId",
                table: "products");

            migrationBuilder.DropCheckConstraint(
                name: "CK_products_ImageSource",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ImageSource",
                table: "suggested_products");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "suggested_products");

            migrationBuilder.DropColumn(
                name: "ImageSource",
                table: "products");

            migrationBuilder.DropColumn(
                name: "SuggestedProductId",
                table: "products");
        }
    }
}
