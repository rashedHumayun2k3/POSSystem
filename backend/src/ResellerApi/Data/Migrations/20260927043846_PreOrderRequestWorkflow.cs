using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class PreOrderRequestWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActivityJson",
                table: "pre_orders",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "PurchaseReference",
                table: "pre_orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResolutionOutcome",
                table: "pre_orders",
                type: "nvarchar(max)",
                nullable: true);

            // Release only reservations owned by legacy open requests, leaving other commitments intact.
            migrationBuilder.Sql("""
                IF EXISTS (
                    SELECT 1 FROM pre_order_items i JOIN pre_orders p ON p.Id=i.PreOrderId
                    WHERE p.Status IN ('CONFIRMED','WAITING_STOCK') AND i.QuantityReserved>0
                    AND NOT EXISTS (SELECT 1 FROM branch_variant_inventories b WHERE b.BranchId=p.BranchId AND b.VariantId=i.VariantId)
                ) THROW 51000, 'Cannot release pre-order reservation: inventory row missing.', 1;
                SELECT p.BusinessId,p.BranchId,i.VariantId,SUM(i.QuantityReserved) AS Qty
                INTO #PreOrderRelease FROM pre_orders p JOIN pre_order_items i ON i.PreOrderId=p.Id
                WHERE p.Status IN ('CONFIRMED','WAITING_STOCK') AND i.QuantityReserved>0
                GROUP BY p.BusinessId,p.BranchId,i.VariantId;
                IF EXISTS (SELECT 1 FROM branch_variant_inventories b JOIN #PreOrderRelease r ON b.BranchId=r.BranchId AND b.VariantId=r.VariantId WHERE b.Committed<r.Qty)
                    THROW 51001, 'Cannot release pre-order reservation: committed stock mismatch.', 1;
                UPDATE b SET Committed=b.Committed-r.Qty
                FROM branch_variant_inventories b JOIN #PreOrderRelease r ON b.BranchId=r.BranchId AND b.VariantId=r.VariantId;
                UPDATE i SET QuantityReserved=0,UpdatedAt=SYSUTCDATETIME() FROM pre_order_items i JOIN pre_orders p ON p.Id=i.PreOrderId WHERE p.Status IN ('CONFIRMED','WAITING_STOCK');
                UPDATE p SET ActivityJson=(SELECT SYSUTCDATETIME() AS At,'System' AS Actor,'Migrated to request workflow' AS Action,CONCAT('Previous status: ',p.Status) AS Note FOR JSON PATH),
                    Status=CASE WHEN Status='COMPLETED' THEN 'RESOLVED' ELSE 'NEW' END,UpdatedAt=SYSUTCDATETIME()
                FROM pre_orders p WHERE Status IN ('CONFIRMED','WAITING_STOCK','COMPLETED');
                DROP TABLE #PreOrderRelease;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("This data migration cannot be reversed safely. Restore a database backup instead.");
        }
    }
}
