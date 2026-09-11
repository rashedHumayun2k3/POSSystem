using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Branch_BackfillMainBranchStock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Copy existing stock from the old single-pool variant_inventories table into the
            // new branch_variant_inventories table, attributed to each business's Main Branch
            // (the only branch that existed before multi-branch support). Without this, stock
            // checks against the new table would see 0 for everything, blocking all sales.
            migrationBuilder.Sql(@"
                INSERT INTO branch_variant_inventories (BranchId, VariantId, OnHand, Committed, Damaged)
                SELECT
                    br.Id,
                    vi.VariantId,
                    vi.OnHand,
                    vi.Committed,
                    vi.Damaged
                FROM variant_inventories vi
                JOIN product_variants pv ON pv.Id = vi.VariantId
                JOIN products p ON p.Id = pv.ProductId
                JOIN branches br ON br.BusinessId = p.BusinessId AND br.IsDefault = 1
                WHERE NOT EXISTS (
                    SELECT 1 FROM branch_variant_inventories bvi
                    WHERE bvi.BranchId = br.Id AND bvi.VariantId = vi.VariantId
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE bvi FROM branch_variant_inventories bvi
                JOIN branches br ON br.Id = bvi.BranchId
                WHERE br.IsDefault = 1;
            ");
        }
    }
}
