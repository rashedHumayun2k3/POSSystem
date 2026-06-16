using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    public partial class Phase3_ForceCompleteReason : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'ForceCompleteReason'
                )
                ALTER TABLE purchase_trips ADD ForceCompleteReason nvarchar(500) NULL;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_trips') AND name = N'ForceCompleteReason'
                )
                ALTER TABLE purchase_trips DROP COLUMN ForceCompleteReason;
            ");
        }
    }
}
