using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Subscriptions_AddPlansAndBilling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "subscription_plans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StaffSeatLimit = table.Column<int>(type: "int", nullable: false),
                    BranchLimit = table.Column<int>(type: "int", nullable: false),
                    PriceMonthly = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    PriceYearly = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    IsPurchasable = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscription_plans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "subscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    CompanyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlanId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BillingCycle = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    TrialEndsAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CurrentPeriodStart = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CurrentPeriodEnd = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CanceledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_subscriptions_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_subscriptions_subscription_plans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "subscription_plans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "subscription_payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    SubscriptionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "DECIMAL(14,2)", nullable: false),
                    Method = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    GatewayPaymentId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    GatewayTrxId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscription_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_subscription_payments_subscriptions_SubscriptionId",
                        column: x => x.SubscriptionId,
                        principalTable: "subscriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_subscription_payments_GatewayPaymentId",
                table: "subscription_payments",
                column: "GatewayPaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subscription_payments_SubscriptionId",
                table: "subscription_payments",
                column: "SubscriptionId");

            migrationBuilder.CreateIndex(
                name: "IX_subscription_plans_Code",
                table: "subscription_plans",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subscriptions_CompanyId",
                table: "subscriptions",
                column: "CompanyId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subscriptions_PlanId",
                table: "subscriptions",
                column: "PlanId");

            // Seed the plan catalog. TRIAL is internal-only (IsPurchasable = 0) — it's the
            // plan a new signup is put on immediately, with the same limits as BUSINESS so a
            // trialing owner can evaluate every feature (multi-branch, multi-staff) before
            // choosing what to actually pay for.
            migrationBuilder.Sql(@"
                INSERT INTO subscription_plans (Id, Code, Name, StaffSeatLimit, BranchLimit, PriceMonthly, PriceYearly, IsPurchasable, IsActive, CreatedAt, UpdatedAt)
                VALUES
                    (NEWID(), 'TRIAL',    N'Free Trial', 2147483647, 2147483647, 0,    0,     0, 1, GETUTCDATE(), GETUTCDATE()),
                    (NEWID(), 'STARTER',  N'Starter',     3,          1,          499,  4990,  1, 1, GETUTCDATE(), GETUTCDATE()),
                    (NEWID(), 'GROWTH',   N'Growth',      10,         3,          1499, 14990, 1, 1, GETUTCDATE(), GETUTCDATE()),
                    (NEWID(), 'BUSINESS', N'Business',    2147483647, 2147483647, 2999, 29990, 1, 1, GETUTCDATE(), GETUTCDATE());
            ");

            // Back-fill a 90-day trial subscription for every company that existed before this
            // migration (so a business created before subscriptions shipped isn't immediately
            // treated as expired by the gate).
            migrationBuilder.Sql(@"
                INSERT INTO subscriptions (Id, CompanyId, PlanId, Status, BillingCycle, TrialEndsAt, CreatedAt, UpdatedAt)
                SELECT
                    NEWID(),
                    c.Id,
                    (SELECT TOP 1 Id FROM subscription_plans WHERE Code = 'TRIAL'),
                    'TRIALING',
                    'MONTHLY',
                    DATEADD(DAY, 90, GETUTCDATE()),
                    GETUTCDATE(),
                    GETUTCDATE()
                FROM companies c
                WHERE c.DeletedAt IS NULL
                  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.CompanyId = c.Id);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "subscription_payments");

            migrationBuilder.DropTable(
                name: "subscriptions");

            migrationBuilder.DropTable(
                name: "subscription_plans");
        }
    }
}
