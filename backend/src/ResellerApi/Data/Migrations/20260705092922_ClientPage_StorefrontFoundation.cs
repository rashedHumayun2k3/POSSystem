using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class ClientPage_StorefrontFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BannerUrl",
                table: "businesses",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "businesses",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowOnMarketplace",
                table: "businesses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "StorefrontEnabled",
                table: "businesses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Subdomain",
                table: "businesses",
                type: "nvarchar(63)",
                maxLength: 63,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "cp_checkout_groups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CustomerPhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cp_checkout_groups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "cp_checkout_group_orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    CheckoutGroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cp_checkout_group_orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_cp_checkout_group_orders_cp_checkout_groups_CheckoutGroupId",
                        column: x => x.CheckoutGroupId,
                        principalTable: "cp_checkout_groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_cp_checkout_group_orders_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_businesses_Subdomain",
                table: "businesses",
                column: "Subdomain",
                unique: true,
                filter: "[Subdomain] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_cp_checkout_group_orders_CheckoutGroupId",
                table: "cp_checkout_group_orders",
                column: "CheckoutGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_cp_checkout_group_orders_OrderId",
                table: "cp_checkout_group_orders",
                column: "OrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cp_checkout_group_orders");

            migrationBuilder.DropTable(
                name: "cp_checkout_groups");

            migrationBuilder.DropIndex(
                name: "IX_businesses_Subdomain",
                table: "businesses");

            migrationBuilder.DropColumn(
                name: "BannerUrl",
                table: "businesses");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "businesses");

            migrationBuilder.DropColumn(
                name: "ShowOnMarketplace",
                table: "businesses");

            migrationBuilder.DropColumn(
                name: "StorefrontEnabled",
                table: "businesses");

            migrationBuilder.DropColumn(
                name: "Subdomain",
                table: "businesses");
        }
    }
}
