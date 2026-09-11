using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Phase4_Orders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Contact",
                table: "couriers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreditLimit = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    StoreCreditBalance = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    IsRejecterFlag = table.Column<bool>(type: "bit", nullable: false),
                    IsClaimerFlag = table.Column<bool>(type: "bit", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_customers_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "delivery_men",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CourierId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CostPerDelivery = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_men", x => x.Id);
                    table.ForeignKey(
                        name: "FK_delivery_men_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_delivery_men_couriers_CourierId",
                        column: x => x.CourierId,
                        principalTable: "couriers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    OrderNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CustomerPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CustomerAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    OrderStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PaymentStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FulfillmentStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsDraft = table.Column<bool>(type: "bit", nullable: false),
                    DiscountType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    DiscountValue = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: true),
                    DeliveryChargeCustomer = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    DeliveryCostActual = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    CourierId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DeliveryManId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TrackingNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AdvancePaid = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    HandlingUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ClientUid = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConfirmedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    HandedOverAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeliveredAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReturnedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelledReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_orders_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_orders_couriers_CourierId",
                        column: x => x.CourierId,
                        principalTable: "couriers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_orders_customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_orders_delivery_men_DeliveryManId",
                        column: x => x.DeliveryManId,
                        principalTable: "delivery_men",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_orders_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_orders_users_HandlingUserId",
                        column: x => x.HandlingUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VariantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Qty = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    UnitCostSnapshot = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: true),
                    OverheadRateSnapshot = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: true),
                    MarketingRateSnapshot = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: true),
                    IsDamagedItem = table.Column<bool>(type: "bit", nullable: false),
                    LotId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_order_items_lots_LotId",
                        column: x => x.LotId,
                        principalTable: "lots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_order_items_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_order_items_product_variants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "product_variants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Method = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_order_payments_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_order_payments_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_status_history",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Track = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ToStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    At = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_status_history", x => x.Id);
                    table.ForeignKey(
                        name: "FK_order_status_history_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_order_status_history_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_customers_BusinessId_Phone",
                table: "customers",
                columns: new[] { "BusinessId", "Phone" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_delivery_men_BusinessId",
                table: "delivery_men",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_men_CourierId",
                table: "delivery_men",
                column: "CourierId");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_LotId",
                table: "order_items",
                column: "LotId");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_OrderId",
                table: "order_items",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_VariantId",
                table: "order_items",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "IX_order_payments_OrderId",
                table: "order_payments",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_order_payments_UserId",
                table: "order_payments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_order_status_history_OrderId",
                table: "order_status_history",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_order_status_history_UserId",
                table: "order_status_history",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_BusinessId_CustomerPhone",
                table: "orders",
                columns: new[] { "BusinessId", "CustomerPhone" });

            migrationBuilder.CreateIndex(
                name: "IX_orders_BusinessId_FulfillmentStatus",
                table: "orders",
                columns: new[] { "BusinessId", "FulfillmentStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_orders_BusinessId_OrderNo",
                table: "orders",
                columns: new[] { "BusinessId", "OrderNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_ClientUid",
                table: "orders",
                column: "ClientUid",
                unique: true,
                filter: "[ClientUid] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_orders_CourierId",
                table: "orders",
                column: "CourierId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_CreatedBy",
                table: "orders",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_orders_CustomerId",
                table: "orders",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_DeliveryManId",
                table: "orders",
                column: "DeliveryManId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_HandlingUserId",
                table: "orders",
                column: "HandlingUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "order_items");

            migrationBuilder.DropTable(
                name: "order_payments");

            migrationBuilder.DropTable(
                name: "order_status_history");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "customers");

            migrationBuilder.DropTable(
                name: "delivery_men");

            migrationBuilder.DropColumn(
                name: "Contact",
                table: "couriers");
        }
    }
}
