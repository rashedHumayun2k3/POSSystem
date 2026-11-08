using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseCashPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BkashAmount",
                table: "expenses",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CashAmount",
                table: "expenses",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "NagadAmount",
                table: "expenses",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BkashAmount",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "CashAmount",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "NagadAmount",
                table: "expenses");
        }
    }
}
