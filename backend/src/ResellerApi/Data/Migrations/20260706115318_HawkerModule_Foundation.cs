using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class HawkerModule_Foundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "BusinessDate",
                table: "orders",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.Sql("UPDATE orders SET BusinessDate = CAST(CreatedAt AS DATE);");

            migrationBuilder.AddColumn<string>(
                name: "DisplayCode",
                table: "lots",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                table: "customers",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SalesChannelsJson",
                table: "businesses",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_BusinessId_BusinessDate",
                table: "orders",
                columns: new[] { "BusinessId", "BusinessDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_orders_BusinessId_BusinessDate",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "BusinessDate",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "DisplayCode",
                table: "lots");

            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "SalesChannelsJson",
                table: "businesses");
        }
    }
}
