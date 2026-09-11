using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSubcategoryAndWarranty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WarrantyDurationUnit",
                table: "products",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WarrantyDurationValue",
                table: "products",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentCategoryId",
                table: "categories",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_categories_ParentCategoryId",
                table: "categories",
                column: "ParentCategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_categories_categories_ParentCategoryId",
                table: "categories",
                column: "ParentCategoryId",
                principalTable: "categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_categories_categories_ParentCategoryId",
                table: "categories");

            migrationBuilder.DropIndex(
                name: "IX_categories_ParentCategoryId",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "WarrantyDurationUnit",
                table: "products");

            migrationBuilder.DropColumn(
                name: "WarrantyDurationValue",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ParentCategoryId",
                table: "categories");
        }
    }
}
