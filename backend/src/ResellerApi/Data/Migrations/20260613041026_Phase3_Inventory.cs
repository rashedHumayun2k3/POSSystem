using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Phase3_Inventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "purchase_trips",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    TripNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SourceType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApprovedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_trips", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_trips_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_purchase_trips_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "variant_inventories",
                columns: table => new
                {
                    VariantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OnHand = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false),
                    Committed = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false),
                    Damaged = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_variant_inventories", x => x.VariantId);
                    table.ForeignKey(
                        name: "FK_variant_inventories_product_variants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "product_variants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "purchase_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VariantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QtyBought = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false),
                    QtyUsable = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: true),
                    TotalCost = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    ShopName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    MemoPhotoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PaidNow = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    DueAmount = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    PromisedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AllocatedSharedCost = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    LandedUnitCost = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_items_product_variants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "product_variants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_purchase_items_purchase_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "purchase_trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "purchase_trip_costs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CostType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Amount = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PhotoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PaidBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_trip_costs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_trip_costs_purchase_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "purchase_trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "lots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    VariantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PurchaseItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QtyIn = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false),
                    LandedUnitCost = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    PerLotValuesJson = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    RemainingQty = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_lots_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_lots_product_variants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "product_variants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lots_purchase_items_PurchaseItemId",
                        column: x => x.PurchaseItemId,
                        principalTable: "purchase_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stock_movements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    VariantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MovementType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Qty = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false),
                    LotId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ReferenceType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ReferenceId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stock_movements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stock_movements_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_stock_movements_lots_LotId",
                        column: x => x.LotId,
                        principalTable: "lots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stock_movements_product_variants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "product_variants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stock_movements_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lots_BusinessId",
                table: "lots",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_lots_PurchaseItemId",
                table: "lots",
                column: "PurchaseItemId");

            migrationBuilder.CreateIndex(
                name: "IX_lots_VariantId",
                table: "lots",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_items_TripId",
                table: "purchase_items",
                column: "TripId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_items_VariantId",
                table: "purchase_items",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_trip_costs_TripId",
                table: "purchase_trip_costs",
                column: "TripId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_trips_BusinessId_TripNo",
                table: "purchase_trips",
                columns: new[] { "BusinessId", "TripNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_trips_CreatedBy",
                table: "purchase_trips",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_BusinessId",
                table: "stock_movements",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_LotId",
                table: "stock_movements",
                column: "LotId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_UserId",
                table: "stock_movements",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_VariantId",
                table: "stock_movements",
                column: "VariantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "purchase_trip_costs");

            migrationBuilder.DropTable(
                name: "stock_movements");

            migrationBuilder.DropTable(
                name: "variant_inventories");

            migrationBuilder.DropTable(
                name: "lots");

            migrationBuilder.DropTable(
                name: "purchase_items");

            migrationBuilder.DropTable(
                name: "purchase_trips");
        }
    }
}
