using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Phase15a_PartnerApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "partners",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AgreedProfitSharePct",
                table: "partners",
                type: "DECIMAL(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankAccountNumber",
                table: "partners",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "partners",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "partners",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "partners",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "partners",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactRelation",
                table: "partners",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NidNumber",
                table: "partners",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "partner_approval_votes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    PartnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
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
                    table.PrimaryKey("PK_partner_approval_votes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_partner_approval_votes_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_partner_approval_votes_partners_PartnerId",
                        column: x => x.PartnerId,
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_partner_approval_votes_partners_VotedByPartnerId",
                        column: x => x.VotedByPartnerId,
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_partner_approval_votes_BusinessId",
                table: "partner_approval_votes",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_partner_approval_votes_PartnerId_VotedByPartnerId",
                table: "partner_approval_votes",
                columns: new[] { "PartnerId", "VotedByPartnerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_partner_approval_votes_VotedByPartnerId",
                table: "partner_approval_votes",
                column: "VotedByPartnerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "partner_approval_votes");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "AgreedProfitSharePct",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "BankAccountNumber",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "EmergencyContactName",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "EmergencyContactPhone",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "EmergencyContactRelation",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "NidNumber",
                table: "partners");
        }
    }
}
