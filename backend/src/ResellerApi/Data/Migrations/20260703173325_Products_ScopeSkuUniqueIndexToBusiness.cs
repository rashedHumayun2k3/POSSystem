using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Products_ScopeSkuUniqueIndexToBusiness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_products_BusinessId",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_products_Sku",
                table: "products");

            migrationBuilder.CreateIndex(
                name: "IX_products_BusinessId_Sku",
                table: "products",
                columns: new[] { "BusinessId", "Sku" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_products_BusinessId_Sku",
                table: "products");

            migrationBuilder.CreateIndex(
                name: "IX_products_BusinessId",
                table: "products",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_products_Sku",
                table: "products",
                column: "Sku",
                unique: true);
        }
    }
}
