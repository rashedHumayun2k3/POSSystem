using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddReasonToStockMovement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "stock_movements",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Reason",
                table: "stock_movements");
        }
    }
}
