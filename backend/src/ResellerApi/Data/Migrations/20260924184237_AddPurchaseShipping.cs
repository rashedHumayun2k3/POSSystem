using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseShipping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "shipping_companies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipping_companies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shipping_companies_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shipping_company_rates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    ShippingCompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShippingMethod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ChargeBasis = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RateAmount = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    MinimumCharge = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shipping_company_rates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shipping_company_rates_shipping_companies_ShippingCompanyId",
                        column: x => x.ShippingCompanyId,
                        principalTable: "shipping_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "purchase_shipments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShippingCompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShippingCompanyRateId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PurchaseTripCostId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShippingCompanyNameSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ShippingMethod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ChargeBasis = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RateAmountSnapshot = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    CurrencyCode = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    BillableQuantity = table.Column<decimal>(type: "DECIMAL(14,3)", nullable: false),
                    CalculatedCost = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    TrackingNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_shipments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_shipments_purchase_trip_costs_PurchaseTripCostId",
                        column: x => x.PurchaseTripCostId,
                        principalTable: "purchase_trip_costs",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_purchase_shipments_purchase_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "purchase_trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_purchase_shipments_shipping_companies_ShippingCompanyId",
                        column: x => x.ShippingCompanyId,
                        principalTable: "shipping_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_purchase_shipments_shipping_company_rates_ShippingCompanyRateId",
                        column: x => x.ShippingCompanyRateId,
                        principalTable: "shipping_company_rates",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_shipments_PurchaseTripCostId",
                table: "purchase_shipments",
                column: "PurchaseTripCostId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_shipments_ShippingCompanyId",
                table: "purchase_shipments",
                column: "ShippingCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_shipments_ShippingCompanyRateId",
                table: "purchase_shipments",
                column: "ShippingCompanyRateId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_shipments_TripId",
                table: "purchase_shipments",
                column: "TripId",
                unique: true,
                filter: "[DeletedAt] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_shipping_companies_BusinessId_Name",
                table: "shipping_companies",
                columns: new[] { "BusinessId", "Name" },
                unique: true,
                filter: "[DeletedAt] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_shipping_company_rates_ShippingCompanyId_ShippingMethod_ChargeBasis",
                table: "shipping_company_rates",
                columns: new[] { "ShippingCompanyId", "ShippingMethod", "ChargeBasis" },
                unique: true,
                filter: "[DeletedAt] IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "purchase_shipments");

            migrationBuilder.DropTable(
                name: "shipping_company_rates");

            migrationBuilder.DropTable(
                name: "shipping_companies");
        }
    }
}
