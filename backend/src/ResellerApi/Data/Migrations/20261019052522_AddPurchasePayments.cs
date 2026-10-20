using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchasePayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "purchase_payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CostKey = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    FundingSource = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    PartnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_purchase_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_purchase_payments_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_purchase_payments_partners_PartnerId",
                        column: x => x.PartnerId,
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_purchase_payments_purchase_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "purchase_trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_payments_BusinessId_PaidAt",
                table: "purchase_payments",
                columns: new[] { "BusinessId", "PaidAt" });

            migrationBuilder.CreateIndex(
                name: "IX_purchase_payments_BusinessId_RequestId",
                table: "purchase_payments",
                columns: new[] { "BusinessId", "RequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_payments_BusinessId_TripId_CostKey",
                table: "purchase_payments",
                columns: new[] { "BusinessId", "TripId", "CostKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_purchase_payments_PartnerId",
                table: "purchase_payments",
                column: "PartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_purchase_payments_TripId",
                table: "purchase_payments",
                column: "TripId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "purchase_payments");
        }
    }
}
