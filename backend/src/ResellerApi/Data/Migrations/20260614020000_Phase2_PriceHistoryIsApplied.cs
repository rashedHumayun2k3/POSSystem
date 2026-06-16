using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    public partial class Phase2_PriceHistoryIsApplied : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'price_history') AND name = N'IsApplied'
                )
                BEGIN
                    ALTER TABLE price_history ADD IsApplied bit NOT NULL DEFAULT 0;
                END

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE object_id = OBJECT_ID(N'price_history')
                      AND name = N'IX_price_history_IsScheduled_IsApplied'
                )
                BEGIN
                    CREATE INDEX IX_price_history_IsScheduled_IsApplied
                        ON price_history (IsScheduled, IsApplied);
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE object_id = OBJECT_ID(N'price_history')
                      AND name = N'IX_price_history_IsScheduled_IsApplied'
                )
                    DROP INDEX IX_price_history_IsScheduled_IsApplied ON price_history;

                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'price_history') AND name = N'IsApplied'
                )
                    ALTER TABLE price_history DROP COLUMN IsApplied;
            ");
        }
    }
}
