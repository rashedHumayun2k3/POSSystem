using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseFunding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FundingPartnerId",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FundingPartnerName",
                table: "expenses",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FundingSource",
                table: "expenses",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequestHash",
                table: "expenses",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RequestId",
                table: "expenses",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ExpenseId",
                table: "capital_injections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "business_expense_funds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OpeningBalancePaisa = table.Column<long>(type: "bigint", nullable: false),
                    RecordedNetPaisaAtOpening = table.Column<long>(type: "bigint", nullable: false),
                    InitializedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_business_expense_funds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_business_expense_funds_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_business_expense_funds_users_InitializedBy",
                        column: x => x.InitializedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_expenses_BusinessId_RequestId",
                table: "expenses",
                columns: new[] { "BusinessId", "RequestId" },
                unique: true,
                filter: "[RequestId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_expenses_FundingPartnerId",
                table: "expenses",
                column: "FundingPartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_capital_injections_ExpenseId",
                table: "capital_injections",
                column: "ExpenseId",
                unique: true,
                filter: "[ExpenseId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_business_expense_funds_BusinessId",
                table: "business_expense_funds",
                column: "BusinessId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_business_expense_funds_InitializedBy",
                table: "business_expense_funds",
                column: "InitializedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_capital_injections_expenses_ExpenseId",
                table: "capital_injections",
                column: "ExpenseId",
                principalTable: "expenses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_expenses_partners_FundingPartnerId",
                table: "expenses",
                column: "FundingPartnerId",
                principalTable: "partners",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_capital_injections_expenses_ExpenseId",
                table: "capital_injections");

            migrationBuilder.DropForeignKey(
                name: "FK_expenses_partners_FundingPartnerId",
                table: "expenses");

            migrationBuilder.DropTable(
                name: "business_expense_funds");

            migrationBuilder.DropIndex(
                name: "IX_expenses_BusinessId_RequestId",
                table: "expenses");

            migrationBuilder.DropIndex(
                name: "IX_expenses_FundingPartnerId",
                table: "expenses");

            migrationBuilder.DropIndex(
                name: "IX_capital_injections_ExpenseId",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "FundingPartnerId",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "FundingPartnerName",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "FundingSource",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "RequestHash",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "RequestId",
                table: "expenses");

            migrationBuilder.DropColumn(
                name: "ExpenseId",
                table: "capital_injections");
        }
    }
}
