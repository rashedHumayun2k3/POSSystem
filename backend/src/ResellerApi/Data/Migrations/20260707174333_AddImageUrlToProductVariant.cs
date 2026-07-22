using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddImageUrlToProductVariant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "product_variants",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "product_variants");
        }
    }
}
