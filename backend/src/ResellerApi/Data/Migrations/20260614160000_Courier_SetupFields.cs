using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Courier_SetupFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ReturnCharge",
                table: "couriers",
                type: "DECIMAL(14,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "CodFeeType",
                table: "couriers",
                type: "nvarchar(4)",
                maxLength: 4,
                nullable: false,
                defaultValue: "PCT");

            migrationBuilder.AddColumn<decimal>(
                name: "CodFeeValue",
                table: "couriers",
                type: "DECIMAL(14,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsDefault",
                table: "couriers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TrackingUrlTemplate",
                table: "couriers",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ReturnCharge", table: "couriers");
            migrationBuilder.DropColumn(name: "CodFeeType", table: "couriers");
            migrationBuilder.DropColumn(name: "CodFeeValue", table: "couriers");
            migrationBuilder.DropColumn(name: "IsDefault", table: "couriers");
            migrationBuilder.DropColumn(name: "TrackingUrlTemplate", table: "couriers");
        }
    }
}
