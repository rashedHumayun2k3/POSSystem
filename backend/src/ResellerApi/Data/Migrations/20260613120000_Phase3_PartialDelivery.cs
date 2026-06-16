using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    public partial class Phase3_PartialDelivery : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IsPostCompletion was supposed to be added in Phase3_LateCosts (which generated empty).
            // Guard with IF NOT EXISTS so it's safe to run on any DB state.
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trip_costs') AND name = N'IsPostCompletion'
                )
                ALTER TABLE purchase_trip_costs ADD IsPostCompletion bit NOT NULL DEFAULT 0;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_items') AND name = N'QtyDamaged'
                )
                ALTER TABLE purchase_items ADD QtyDamaged DECIMAL(12,3) NULL;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_items') AND name = N'ReceivedAt'
                )
                ALTER TABLE purchase_items ADD ReceivedAt datetime2 NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE purchase_trip_costs DROP COLUMN IF EXISTS IsPostCompletion;");
            migrationBuilder.Sql("ALTER TABLE purchase_items DROP COLUMN IF EXISTS QtyDamaged;");
            migrationBuilder.Sql("ALTER TABLE purchase_items DROP COLUMN IF EXISTS ReceivedAt;");
        }
    }
}
