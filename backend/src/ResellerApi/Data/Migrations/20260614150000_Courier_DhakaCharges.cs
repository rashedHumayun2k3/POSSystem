using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Courier_DhakaCharges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DefaultChargeRate",
                table: "couriers");

            migrationBuilder.AddColumn<decimal>(
                name: "InsideDhakaCharge",
                table: "couriers",
                type: "DECIMAL(14,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "OutsideDhakaCharge",
                table: "couriers",
                type: "DECIMAL(14,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InsideDhakaCharge",
                table: "couriers");

            migrationBuilder.DropColumn(
                name: "OutsideDhakaCharge",
                table: "couriers");

            migrationBuilder.AddColumn<decimal>(
                name: "DefaultChargeRate",
                table: "couriers",
                type: "DECIMAL(14,2)",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
