using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseShipmentLots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_purchase_shipments_TripId",
                table: "purchase_shipments");

            migrationBuilder.AddColumn<bool>(
                name: "UsesShipmentLots",
                table: "purchase_trips",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ShipmentId",
                table: "purchase_trip_costs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "ShippingCompanyId",
                table: "purchase_shipments",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AlterColumn<Guid>(
                name: "PurchaseTripCostId",
                table: "purchase_shipments",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<decimal>(
                name: "BilledWeightGrams",
                table: "purchase_shipments",
                type: "decimal(14,3)",
                precision: 14,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DeclaredWeightGrams",
                table: "purchase_shipments",
                type: "decimal(14,3)",
                precision: 14,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsLegacy",
                table: "purchase_shipments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LotNo",
                table: "purchase_shipments",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "MeasuredWeightGrams",
                table: "purchase_shipments",
                type: "decimal(14,3)",
                precision: 14,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "ShippedDate",
                table: "purchase_shipments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "purchase_shipments",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "ShipmentId",
                table: "purchase_receive_sessions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AllocatedShippingCost",
                table: "purchase_receive_session_items",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LossAmount",
                table: "purchase_receive_session_items",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MeasuredWeightGrams",
                table: "purchase_receive_session_items",
                type: "decimal(14,3)",
                precision: 14,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "QtyShipped",
                table: "purchase_items",
                type: "decimal(12,3)",
                precision: 12,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitWeightGrams",
                table: "product_variants",
                type: "decimal(14,3)",
                precision: 14,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            // Preserve historical costs, payment keys and inventory valuations. Do not invent lot assignments.
            migrationBuilder.Sql(@"EXEC(N'UPDATE purchase_trips SET Status = CASE Status
                WHEN ''PENDING_APPROVAL'' THEN ''DRAFT'' WHEN ''RECEIVING'' THEN ''IN_PROGRESS'' ELSE Status END;
                UPDATE p SET Status = ''IN_PROGRESS'' FROM purchase_trips p WHERE p.Status = ''DRAFT''
                    AND EXISTS (SELECT 1 FROM purchase_receive_sessions s WHERE s.TripId = p.Id AND s.Status = ''APPROVED'' AND s.DeletedAt IS NULL);
                UPDATE purchase_shipments SET IsLegacy = 1, LotNo = ''LEGACY-'' + LEFT(CONVERT(varchar(36), Id), 32),
                    Status = CASE WHEN EXISTS (SELECT 1 FROM purchase_trips p WHERE p.Id = TripId AND p.Status = ''COMPLETED'')
                        THEN ''RECEIVED'' ELSE ''READY'' END,
                    BilledWeightGrams = CASE WHEN ChargeBasis = ''PER_KG'' THEN BillableQuantity * 1000 ELSE 0 END;
                UPDATE purchase_items SET QtyShipped = QtyUsable + QtyDamaged + QtyMissing;
                UPDATE r SET LossAmount = ROUND(CASE WHEN i.QtyBought > 0 THEN i.TotalCost / i.QtyBought * r.QtyMissing ELSE 0 END, 2)
                    FROM purchase_receive_session_items r JOIN purchase_items i ON i.Id = r.PurchaseItemId
                    JOIN purchase_receive_sessions s ON s.Id = r.SessionId WHERE s.Status = ''APPROVED'';');");

            migrationBuilder.CreateTable(
                name: "purchase_shipment_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShipmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PurchaseItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Qty = table.Column<decimal>(type: "decimal(12,3)", precision: 12, scale: 3, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_shipment_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_shipment_items_purchase_items_PurchaseItemId",
                        column: x => x.PurchaseItemId,
                        principalTable: "purchase_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_purchase_shipment_items_purchase_shipments_ShipmentId",
                        column: x => x.ShipmentId,
                        principalTable: "purchase_shipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_trip_costs_ShipmentId",
                table: "purchase_trip_costs",
                column: "ShipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_shipments_TripId_LotNo",
                table: "purchase_shipments",
                columns: new[] { "TripId", "LotNo" },
                unique: true,
                filter: "[DeletedAt] IS NULL");

            // Dynamic SQL also supports applying the generated migration script as a single batch:
            // SQL Server must compile this predicate after the new ShipmentId column exists.
            migrationBuilder.Sql(@"EXEC(N'CREATE UNIQUE INDEX [IX_purchase_receive_sessions_ShipmentId]
                ON [purchase_receive_sessions] ([ShipmentId])
                WHERE [ShipmentId] IS NOT NULL AND [DeletedAt] IS NULL AND [Status] <> ''REJECTED'';');");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_shipment_items_PurchaseItemId",
                table: "purchase_shipment_items",
                column: "PurchaseItemId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_shipment_items_ShipmentId_PurchaseItemId",
                table: "purchase_shipment_items",
                columns: new[] { "ShipmentId", "PurchaseItemId" },
                unique: true,
                filter: "[DeletedAt] IS NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_purchase_receive_sessions_purchase_shipments_ShipmentId",
                table: "purchase_receive_sessions",
                column: "ShipmentId",
                principalTable: "purchase_shipments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_purchase_trip_costs_purchase_shipments_ShipmentId",
                table: "purchase_trip_costs",
                column: "ShipmentId",
                principalTable: "purchase_shipments",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rolling back after new lots exist would discard shipment and loss history.
            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM purchase_shipments WHERE IsLegacy = 0)
                THROW 51000, 'Cannot roll back shipment lots after new lots have been created. Restore a pre-migration backup.', 1;
                UPDATE purchase_trips SET Status = CASE Status WHEN 'PRODUCT_APPROVED' THEN 'RECEIVING'
                    WHEN 'IN_PROGRESS' THEN 'RECEIVING' ELSE Status END;");
            migrationBuilder.DropForeignKey(
                name: "FK_purchase_receive_sessions_purchase_shipments_ShipmentId",
                table: "purchase_receive_sessions");

            migrationBuilder.DropForeignKey(
                name: "FK_purchase_trip_costs_purchase_shipments_ShipmentId",
                table: "purchase_trip_costs");

            migrationBuilder.DropTable(
                name: "purchase_shipment_items");

            migrationBuilder.DropIndex(
                name: "IX_purchase_trip_costs_ShipmentId",
                table: "purchase_trip_costs");

            migrationBuilder.DropIndex(
                name: "IX_purchase_shipments_TripId_LotNo",
                table: "purchase_shipments");

            migrationBuilder.DropIndex(
                name: "IX_purchase_receive_sessions_ShipmentId",
                table: "purchase_receive_sessions");

            migrationBuilder.DropColumn(
                name: "UsesShipmentLots",
                table: "purchase_trips");

            migrationBuilder.DropColumn(
                name: "ShipmentId",
                table: "purchase_trip_costs");

            migrationBuilder.DropColumn(
                name: "BilledWeightGrams",
                table: "purchase_shipments");

            migrationBuilder.DropColumn(
                name: "DeclaredWeightGrams",
                table: "purchase_shipments");

            migrationBuilder.DropColumn(
                name: "IsLegacy",
                table: "purchase_shipments");

            migrationBuilder.DropColumn(
                name: "LotNo",
                table: "purchase_shipments");

            migrationBuilder.DropColumn(
                name: "MeasuredWeightGrams",
                table: "purchase_shipments");

            migrationBuilder.DropColumn(
                name: "ShippedDate",
                table: "purchase_shipments");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "purchase_shipments");

            migrationBuilder.DropColumn(
                name: "ShipmentId",
                table: "purchase_receive_sessions");

            migrationBuilder.DropColumn(
                name: "AllocatedShippingCost",
                table: "purchase_receive_session_items");

            migrationBuilder.DropColumn(
                name: "LossAmount",
                table: "purchase_receive_session_items");

            migrationBuilder.DropColumn(
                name: "MeasuredWeightGrams",
                table: "purchase_receive_session_items");

            migrationBuilder.DropColumn(
                name: "QtyShipped",
                table: "purchase_items");

            migrationBuilder.DropColumn(
                name: "UnitWeightGrams",
                table: "product_variants");

            migrationBuilder.AlterColumn<Guid>(
                name: "ShippingCompanyId",
                table: "purchase_shipments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "PurchaseTripCostId",
                table: "purchase_shipments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_shipments_TripId",
                table: "purchase_shipments",
                column: "TripId",
                unique: true,
                filter: "[DeletedAt] IS NULL");
        }
    }
}
