using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddReusableDiscounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "RegularPriceSnapshot",
                table: "price_slots",
                type: "DECIMAL(14,2)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReusableDiscountId",
                table: "price_slots",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "reusable_discounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Percent = table.Column<decimal>(type: "DECIMAL(5,2)", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reusable_discounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_reusable_discounts_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_reusable_discounts_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_price_slots_ReusableDiscountId",
                table: "price_slots",
                column: "ReusableDiscountId");

            migrationBuilder.CreateIndex(
                name: "IX_reusable_discounts_BusinessId_IsArchived_CreatedAt",
                table: "reusable_discounts",
                columns: new[] { "BusinessId", "IsArchived", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_reusable_discounts_CreatedBy",
                table: "reusable_discounts",
                column: "CreatedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_price_slots_reusable_discounts_ReusableDiscountId",
                table: "price_slots",
                column: "ReusableDiscountId",
                principalTable: "reusable_discounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_price_slots_reusable_discounts_ReusableDiscountId",
                table: "price_slots");

            migrationBuilder.DropTable(
                name: "reusable_discounts");

            migrationBuilder.DropIndex(
                name: "IX_price_slots_ReusableDiscountId",
                table: "price_slots");

            migrationBuilder.DropColumn(
                name: "RegularPriceSnapshot",
                table: "price_slots");

            migrationBuilder.DropColumn(
                name: "ReusableDiscountId",
                table: "price_slots");
        }
    }
}
