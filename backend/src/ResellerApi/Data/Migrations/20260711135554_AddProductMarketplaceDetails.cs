using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProductMarketplaceDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "YoutubeUrl",
                table: "products",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "product_marketplace_details",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    ProductId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Section = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_marketplace_details", x => x.Id);
                    table.ForeignKey(
                        name: "FK_product_marketplace_details_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_product_marketplace_details_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_product_marketplace_details_BusinessId",
                table: "product_marketplace_details",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_product_marketplace_details_ProductId",
                table: "product_marketplace_details",
                column: "ProductId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "product_marketplace_details");

            migrationBuilder.DropColumn(
                name: "YoutubeUrl",
                table: "products");
        }
    }
}
