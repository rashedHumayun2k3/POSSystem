using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierReturns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "supplier_returns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SupplierReturnNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SupplierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResolvedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier_returns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_supplier_returns_branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "branches",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_supplier_returns_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_supplier_returns_purchase_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "purchase_trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_supplier_returns_suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "suppliers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_supplier_returns_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_supplier_returns_users_ResolvedBy",
                        column: x => x.ResolvedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "supplier_return_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    ReturnId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VariantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QtyReturned = table.Column<decimal>(type: "DECIMAL(12,3)", nullable: false),
                    UnitCost = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    ResolutionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ResolutionAmount = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: true),
                    ReplacementTripId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier_return_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_supplier_return_items_product_variants_VariantId",
                        column: x => x.VariantId,
                        principalTable: "product_variants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_supplier_return_items_purchase_trips_ReplacementTripId",
                        column: x => x.ReplacementTripId,
                        principalTable: "purchase_trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_supplier_return_items_supplier_returns_ReturnId",
                        column: x => x.ReturnId,
                        principalTable: "supplier_returns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_supplier_return_items_ReplacementTripId",
                table: "supplier_return_items",
                column: "ReplacementTripId");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_return_items_ReturnId",
                table: "supplier_return_items",
                column: "ReturnId");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_return_items_VariantId",
                table: "supplier_return_items",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_returns_BranchId",
                table: "supplier_returns",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_returns_BusinessId_SupplierReturnNo",
                table: "supplier_returns",
                columns: new[] { "BusinessId", "SupplierReturnNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_supplier_returns_CreatedBy",
                table: "supplier_returns",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_returns_ResolvedBy",
                table: "supplier_returns",
                column: "ResolvedBy");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_returns_SupplierId",
                table: "supplier_returns",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_returns_TripId",
                table: "supplier_returns",
                column: "TripId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "supplier_return_items");

            migrationBuilder.DropTable(
                name: "supplier_returns");
        }
    }
}
