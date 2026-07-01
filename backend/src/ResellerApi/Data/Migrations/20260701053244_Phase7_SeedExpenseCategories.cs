using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Phase7_SeedExpenseCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_petty_cash_txns_petty_cash_boxes_BoxId",
                table: "petty_cash_txns");

            migrationBuilder.AddForeignKey(
                name: "FK_petty_cash_txns_petty_cash_boxes_BoxId",
                table: "petty_cash_txns",
                column: "BoxId",
                principalTable: "petty_cash_boxes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Seed 7 system expense categories for every existing business
            migrationBuilder.Sql(@"
                INSERT INTO expense_categories (Id, BusinessId, Code, Name, IsSystem, IsDefault, IsActive, CreatedAt, UpdatedAt)
                SELECT
                    NEWID(),
                    b.Id,
                    cats.Code,
                    cats.Name,
                    1,
                    CASE WHEN cats.Code = 'OFFICE' THEN 1 ELSE 0 END,
                    1,
                    GETUTCDATE(),
                    GETUTCDATE()
                FROM businesses b
                CROSS JOIN (VALUES
                    ('OFFICE',          N'Office & Admin'),
                    ('STAFF',           N'Staff & Salary'),
                    ('MARKETING',       N'Marketing & Ads'),
                    ('DELIVERY',        N'Delivery & Shipping'),
                    ('TRIP',            N'Trip & Purchase Costs'),
                    ('EQUIPMENT_OTHER', N'Equipment & Other'),
                    ('OWNER_DRAWING',   N'Owner Drawing')
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
            migrationBuilder.DropForeignKey(
                name: "FK_petty_cash_txns_petty_cash_boxes_BoxId",
                table: "petty_cash_txns");

            migrationBuilder.AddForeignKey(
                name: "FK_petty_cash_txns_petty_cash_boxes_BoxId",
                table: "petty_cash_txns",
                column: "BoxId",
                principalTable: "petty_cash_boxes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
