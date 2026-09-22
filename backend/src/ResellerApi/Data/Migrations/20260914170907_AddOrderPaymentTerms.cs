using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderPaymentTerms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentTerms",
                table: "orders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "COD");

            migrationBuilder.AddCheckConstraint(
                name: "CK_orders_PaymentTerms",
                table: "orders",
                sql: "[PaymentTerms] IN ('COD', 'PREPAID', 'CREDIT')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_orders_PaymentTerms",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                table: "orders");
        }
    }
}
