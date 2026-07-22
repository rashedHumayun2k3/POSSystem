using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMarketplaceDetailTemplateLabels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "marketplace_detail_template_labels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Section = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_marketplace_detail_template_labels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_marketplace_detail_template_labels_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_marketplace_detail_template_labels_BusinessId_Section_Label",
                table: "marketplace_detail_template_labels",
                columns: new[] { "BusinessId", "Section", "Label" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "marketplace_detail_template_labels");
        }
    }
}
