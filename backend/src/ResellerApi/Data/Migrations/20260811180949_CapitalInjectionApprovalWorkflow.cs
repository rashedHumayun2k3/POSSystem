using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class CapitalInjectionApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "capital_injections",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedBy",
                table: "capital_injections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedAt",
                table: "capital_injections",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RejectedBy",
                table: "capital_injections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "capital_injections",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "capital_injections",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "DRAFT");

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAt",
                table: "capital_injections",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedBy",
                table: "capital_injections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE capital_injections
                SET Status = 'APPROVED',
                    ApprovedAt = COALESCE(ApprovedAt, UpdatedAt)
                WHERE EXISTS (
                    SELECT 1
                    FROM capital_ledger
                    WHERE capital_ledger.ReferenceType = 'CapitalInjection'
                      AND capital_ledger.ReferenceId = capital_injections.Id
                )
                """);

            migrationBuilder.CreateTable(
                name: "capital_injection_approval_votes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    CapitalInjectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VotedByPartnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Decision = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    VotedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_capital_injection_approval_votes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_capital_injection_approval_votes_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_capital_injection_approval_votes_capital_injections_CapitalInjectionId",
                        column: x => x.CapitalInjectionId,
                        principalTable: "capital_injections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_capital_injection_approval_votes_partners_VotedByPartnerId",
                        column: x => x.VotedByPartnerId,
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_capital_injection_approval_votes_BusinessId",
                table: "capital_injection_approval_votes",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_capital_injection_approval_votes_CapitalInjectionId_VotedByPartnerId",
                table: "capital_injection_approval_votes",
                columns: new[] { "CapitalInjectionId", "VotedByPartnerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_capital_injection_approval_votes_VotedByPartnerId",
                table: "capital_injection_approval_votes",
                column: "VotedByPartnerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "capital_injection_approval_votes");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "RejectedAt",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "RejectedBy",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                table: "capital_injections");

            migrationBuilder.DropColumn(
                name: "SubmittedBy",
                table: "capital_injections");
        }
    }
}
