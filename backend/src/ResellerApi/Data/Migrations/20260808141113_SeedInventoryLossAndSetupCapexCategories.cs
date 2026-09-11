using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class SeedInventoryLossAndSetupCapexCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Same idempotent pattern as Phase7_SeedExpenseCategories — safe to re-run, and
            // covers businesses created after this migration runs too (NOT EXISTS guard means
            // any business missing either code gets it backfilled next deploy).
            migrationBuilder.Sql(@"
                INSERT INTO expense_categories (Id, BusinessId, Code, Name, IsSystem, IsDefault, IsActive, CreatedAt, UpdatedAt)
                SELECT
                    NEWID(),
                    b.Id,
                    cats.Code,
                    cats.Name,
                    1,
                    0,
                    1,
                    GETUTCDATE(),
                    GETUTCDATE()
                FROM businesses b
                CROSS JOIN (VALUES
                    ('INVENTORY_LOSS', N'Inventory & Stock Loss'),
                    ('SETUP_CAPEX',    N'Initial Setup & Assets')
                ) AS cats(Code, Name)
                WHERE b.DeletedAt IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM expense_categories ec
                      WHERE ec.BusinessId = b.Id
                        AND ec.Code = cats.Code
                        AND ec.DeletedAt IS NULL
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM expense_categories
                WHERE Code IN ('INVENTORY_LOSS', 'SETUP_CAPEX')
                  AND NOT EXISTS (
                      SELECT 1 FROM expenses e WHERE e.CategoryId = expense_categories.Id
                  );
            ");
        }
    }
}
