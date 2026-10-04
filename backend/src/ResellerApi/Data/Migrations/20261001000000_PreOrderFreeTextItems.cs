using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations;

public partial class PreOrderFreeTextItems : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Release any reservations created by older pre-order workflows before removing the
        // reservation data and variant relationship.
        migrationBuilder.Sql("""
            ;WITH Reserved AS (
                SELECT p.BranchId, i.VariantId, SUM(i.QuantityReserved) AS Quantity
                FROM pre_order_items i
                INNER JOIN pre_orders p ON p.Id = i.PreOrderId
                WHERE p.BranchId IS NOT NULL AND i.QuantityReserved > 0
                GROUP BY p.BranchId, i.VariantId
            )
            UPDATE inventory
            SET Committed = CASE WHEN inventory.Committed > Reserved.Quantity
                                 THEN inventory.Committed - Reserved.Quantity ELSE 0 END
            FROM branch_variant_inventories inventory
            INNER JOIN Reserved ON Reserved.BranchId = inventory.BranchId
                               AND Reserved.VariantId = inventory.VariantId;
            """);

        migrationBuilder.DropForeignKey(name: "FK_pre_order_items_product_variants_VariantId", table: "pre_order_items");
        migrationBuilder.DropForeignKey(name: "FK_pre_order_items_products_ProductId", table: "pre_order_items");
        migrationBuilder.DropIndex(name: "IX_pre_order_items_ProductId", table: "pre_order_items");
        migrationBuilder.DropIndex(name: "IX_pre_order_items_VariantId", table: "pre_order_items");

        migrationBuilder.RenameColumn(name: "ProductNameSnapshot", table: "pre_order_items", newName: "ProductName");
        migrationBuilder.AlterColumn<decimal>(
            name: "QuantityRequested",
            table: "pre_order_items",
            type: "DECIMAL(18,3)",
            nullable: true,
            oldClrType: typeof(decimal),
            oldType: "DECIMAL(18,3)");

        migrationBuilder.DropColumn(name: "ProductId", table: "pre_order_items");
        migrationBuilder.DropColumn(name: "VariantId", table: "pre_order_items");
        migrationBuilder.DropColumn(name: "QuantityReserved", table: "pre_order_items");
        migrationBuilder.DropColumn(name: "QuantityFulfilled", table: "pre_order_items");
        migrationBuilder.DropColumn(name: "UnitPriceSnapshot", table: "pre_order_items");
        migrationBuilder.DropColumn(name: "VariantNameSnapshot", table: "pre_order_items");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        throw new NotSupportedException("Pre-order product and variant references were intentionally removed and cannot be reconstructed from free-text item names.");
    }
}
