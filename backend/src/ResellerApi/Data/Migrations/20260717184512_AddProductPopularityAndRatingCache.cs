using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProductPopularityAndRatingCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AverageRating",
                table: "products",
                type: "DECIMAL(3,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PopularityScore",
                table: "products",
                type: "DECIMAL(14,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "ReviewCount",
                table: "products",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_products_ShowOnMarketplace_Status_AverageRating",
                table: "products",
                columns: new[] { "ShowOnMarketplace", "Status", "AverageRating" });

            migrationBuilder.CreateIndex(
                name: "IX_products_ShowOnMarketplace_Status_PopularityScore",
                table: "products",
                columns: new[] { "ShowOnMarketplace", "Status", "PopularityScore" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_products_ShowOnMarketplace_Status_AverageRating",
                table: "products");

            migrationBuilder.DropIndex(
                name: "IX_products_ShowOnMarketplace_Status_PopularityScore",
                table: "products");

            migrationBuilder.DropColumn(
                name: "AverageRating",
                table: "products");

            migrationBuilder.DropColumn(
                name: "PopularityScore",
                table: "products");

            migrationBuilder.DropColumn(
                name: "ReviewCount",
                table: "products");
        }
    }
}
