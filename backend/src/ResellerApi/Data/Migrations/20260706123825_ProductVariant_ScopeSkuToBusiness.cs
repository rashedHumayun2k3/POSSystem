using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProductVariant_ScopeSkuToBusiness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_product_variants_Sku",
                table: "product_variants");

            migrationBuilder.AddColumn<Guid>(
                name: "BusinessId",
                table: "product_variants",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.Sql(@"
                UPDATE pv SET pv.BusinessId = p.BusinessId
                FROM product_variants pv
                JOIN products p ON p.Id = pv.ProductId;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_product_variants_BusinessId_Sku",
                table: "product_variants",
                columns: new[] { "BusinessId", "Sku" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_product_variants_businesses_BusinessId",
                table: "product_variants",
                column: "BusinessId",
                principalTable: "businesses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_product_variants_businesses_BusinessId",
                table: "product_variants");

            migrationBuilder.DropIndex(
                name: "IX_product_variants_BusinessId_Sku",
                table: "product_variants");

            migrationBuilder.DropColumn(
                name: "BusinessId",
                table: "product_variants");

            migrationBuilder.CreateIndex(
                name: "IX_product_variants_Sku",
                table: "product_variants",
                column: "Sku",
                unique: true);
        }
    }
}
