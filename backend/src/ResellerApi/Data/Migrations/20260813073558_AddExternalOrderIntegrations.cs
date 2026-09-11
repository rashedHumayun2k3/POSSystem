using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalOrderIntegrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalOrderId",
                table: "orders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "orders",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "orders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "external_order_integrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    KeyHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SourceWebsiteUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_external_order_integrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_external_order_integrations_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_external_order_integrations_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_orders_BusinessId_ExternalOrderId",
                table: "orders",
                columns: new[] { "BusinessId", "ExternalOrderId" },
                filter: "[ExternalOrderId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_orders_BusinessId_Source",
                table: "orders",
                columns: new[] { "BusinessId", "Source" });

            migrationBuilder.CreateIndex(
                name: "IX_external_order_integrations_BusinessId",
                table: "external_order_integrations",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_external_order_integrations_CreatedBy",
                table: "external_order_integrations",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_external_order_integrations_KeyHash",
                table: "external_order_integrations",
                column: "KeyHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "external_order_integrations");

            migrationBuilder.DropIndex(
                name: "IX_orders_BusinessId_ExternalOrderId",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_BusinessId_Source",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ExternalOrderId",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "orders");
        }
    }
}
