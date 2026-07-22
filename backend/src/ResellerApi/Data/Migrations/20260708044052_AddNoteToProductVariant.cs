using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteToProductVariant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "product_variants",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Note",
                table: "product_variants");
        }
    }
}
