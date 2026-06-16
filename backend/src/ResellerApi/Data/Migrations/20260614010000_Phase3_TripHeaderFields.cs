using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    public partial class Phase3_TripHeaderFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'expected_delivery_date'
                )
                BEGIN
                    ALTER TABLE purchase_trips ADD expected_delivery_date DATETIME2 NULL;
                END

                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'supplier_po_ref'
                )
                BEGIN
                    ALTER TABLE purchase_trips ADD supplier_po_ref NVARCHAR(100) NULL;
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'expected_delivery_date'
                )
                    ALTER TABLE purchase_trips DROP COLUMN expected_delivery_date;

                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'supplier_po_ref'
                )
                    ALTER TABLE purchase_trips DROP COLUMN supplier_po_ref;
            ");
        }
    }
}
