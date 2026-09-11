using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCourierCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CourierCatalogId",
                table: "couriers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "courier_catalog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    InsideDhakaCharge = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    OutsideDhakaCharge = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    ReturnCharge = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    CodFeeType = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false, defaultValue: "PCT"),
                    CodFeeValue = table.Column<decimal>(type: "DECIMAL(14,4)", nullable: false),
                    TrackingUrlTemplate = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_courier_catalog", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_couriers_CourierCatalogId",
                table: "couriers",
                column: "CourierCatalogId");

            migrationBuilder.AddForeignKey(
                name: "FK_couriers_courier_catalog_CourierCatalogId",
                table: "couriers",
                column: "CourierCatalogId",
                principalTable: "courier_catalog",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_couriers_courier_catalog_CourierCatalogId",
                table: "couriers");

            migrationBuilder.DropTable(
                name: "courier_catalog");

            migrationBuilder.DropIndex(
                name: "IX_couriers_CourierCatalogId",
                table: "couriers");

            migrationBuilder.DropColumn(
                name: "CourierCatalogId",
                table: "couriers");
        }
    }
}
