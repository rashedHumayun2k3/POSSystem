using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class CapitalInjectionPaymentProof : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankAccountNumber",
                table: "capital_injections",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "capital_injections",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ChequeNumber",
                table: "capital_injections",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaidTo",
                table: "capital_injections",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "capital_injections",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "CASH");

            migrationBuilder.AddColumn<string>(
                name: "PaymentReference",
                table: "capital_injections",
                type: "nvarchar(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProofImageUrl",
                table: "capital_injections",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankAccountNumber",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "ChequeNumber",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "PaidTo",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "PaymentReference",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "ProofImageUrl",
                table: "capital_injections");
        }
    }
}
