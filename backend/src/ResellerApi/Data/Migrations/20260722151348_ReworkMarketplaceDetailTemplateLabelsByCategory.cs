using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReworkMarketplaceDetailTemplateLabelsByCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The table's scoping is changing from BusinessId to CategoryId — these are
            // semantically unrelated columns (a business's own Id is never a valid CategoryId),
            // so existing rows can't be carried forward. Clear them; the curated seed migration
            // that follows repopulates the table per-category from scratch.
            migrationBuilder.Sql("DELETE FROM marketplace_detail_template_labels;");

            migrationBuilder.DropForeignKey(
                name: "FK_marketplace_detail_template_labels_businesses_BusinessId",
                table: "marketplace_detail_template_labels");

            migrationBuilder.DropIndex(
                name: "IX_marketplace_detail_template_labels_BusinessId_Section_Label",
                table: "marketplace_detail_template_labels");

            migrationBuilder.DropColumn(
                name: "BusinessId",
                table: "marketplace_detail_template_labels");

            migrationBuilder.AddColumn<System.Guid>(
                name: "CategoryId",
                table: "marketplace_detail_template_labels",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: System.Guid.Empty);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "marketplace_detail_template_labels",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ValuePlaceholder",
                table: "marketplace_detail_template_labels",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_marketplace_detail_template_labels_CategoryId_Section_Label",
                table: "marketplace_detail_template_labels",
                columns: new[] { "CategoryId", "Section", "Label" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_marketplace_detail_template_labels_categories_CategoryId",
                table: "marketplace_detail_template_labels",
                column: "CategoryId",
                principalTable: "categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not reversible — BusinessId is gone for good, this table is CategoryId-scoped now.
            throw new System.NotSupportedException(
                "This migration is not reversible: marketplace_detail_template_labels no longer has a BusinessId column.");
        }
    }
}
