using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class BackfillDefaultCouriers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Data-only backfill (no schema change): businesses created before couriers were
            // auto-provisioned at signup would otherwise silently charge ৳0 delivery on
            // ClientPage checkout forever, since nothing else ever prompts an owner to visit
            // Settings → Couriers. Idempotent — re-running finds nothing left to backfill.
            migrationBuilder.Sql(@"
                INSERT INTO couriers (BusinessId, Name, InsideDhakaCharge, OutsideDhakaCharge, ReturnCharge, CodFeeType, CodFeeValue, IsDefault, IsActive, CreatedAt, UpdatedAt)
                SELECT b.Id, N'Default Courier', 60.00, 120.00, 0.00, N'PCT', 0.0000, 1, 1, SYSUTCDATETIME(), SYSUTCDATETIME()
                FROM businesses b
                WHERE b.DeletedAt IS NULL
                  AND NOT EXISTS (SELECT 1 FROM couriers c WHERE c.BusinessId = b.Id AND c.DeletedAt IS NULL);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM couriers WHERE Name = N'Default Courier' AND IsDefault = 1;
            ");
        }
    }
}
