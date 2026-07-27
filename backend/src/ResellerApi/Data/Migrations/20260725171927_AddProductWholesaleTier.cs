using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProductWholesaleTier : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "WholesaleMinQty",
                table: "products",
                type: "DECIMAL(12,3)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WholesaleUnitPrice",
                table: "products",
                type: "DECIMAL(14,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WholesaleMinQty",
                table: "products");

            migrationBuilder.DropColumn(
                name: "WholesaleUnitPrice",
                table: "products");
        }
    }
}
