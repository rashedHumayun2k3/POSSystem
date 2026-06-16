using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    public partial class Phase3_FixTripHeaderColumnNames : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Previous migration added these as snake_case; EF expects PascalCase
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'expected_delivery_date'
                )
                    EXEC sp_rename 'purchase_trips.expected_delivery_date', 'ExpectedDeliveryDate', 'COLUMN';

                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'supplier_po_ref'
                )
                    EXEC sp_rename 'purchase_trips.supplier_po_ref', 'SupplierPoRef', 'COLUMN';

                -- Add if the previous migration somehow didn't run at all
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'ExpectedDeliveryDate'
                )
                    ALTER TABLE purchase_trips ADD ExpectedDeliveryDate DATETIME2 NULL;

                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'SupplierPoRef'
                )
                    ALTER TABLE purchase_trips ADD SupplierPoRef NVARCHAR(100) NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'ExpectedDeliveryDate'
                )
                    EXEC sp_rename 'purchase_trips.ExpectedDeliveryDate', 'expected_delivery_date', 'COLUMN';

                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'SupplierPoRef'
                )
                    EXEC sp_rename 'purchase_trips.SupplierPoRef', 'supplier_po_ref', 'COLUMN';
            ");
        }
    }
}
