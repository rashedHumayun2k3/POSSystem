using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Phase15a_PartnershipFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: `dotnet ef migrations add` also wanted to recreate ~25 pre-existing tables here
            // (companies, users, products, stock_movements, etc.) because AppDbContextModelSnapshot.cs
            // had drifted out of sync with the migrations actually applied to the database (pre-existing
            // issue, not caused by this change — likely from hand-authored migrations in earlier phases
            // that were never run through `migrations add`). Those blocks were removed by hand below;
            // only the genuinely new Module 15 tables remain. The regenerated Designer.cs/
            // AppDbContextModelSnapshot.cs now correctly reflect the full current model, fixing that
            // drift for future migrations.

            migrationBuilder.CreateTable(
                name: "partners",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    PartnerType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DeferredLossPaisa = table.Column<long>(type: "bigint", nullable: false),
                    JoinDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_partners", x => x.Id);
                    table.ForeignKey(
                        name: "FK_partners_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "capital_injections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    PartnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AmountPaisa = table.Column<long>(type: "bigint", nullable: false),
                    InjectedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LockInMonths = table.Column<int>(type: "int", nullable: false),
                    LockInExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_capital_injections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_capital_injections_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_capital_injections_partners_PartnerId",
                        column: x => x.PartnerId,
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_capital_injections_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "capital_ledger",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWSEQUENTIALID()"),
                    PartnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntryType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Bucket = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    AmountPaisa = table.Column<long>(type: "bigint", nullable: false),
                    BalanceAfterPaisa = table.Column<long>(type: "bigint", nullable: false),
                    ReferenceType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ReferenceId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_capital_ledger", x => x.Id);
                    table.ForeignKey(
                        name: "FK_capital_ledger_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_capital_ledger_partners_PartnerId",
                        column: x => x.PartnerId,
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_capital_ledger_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_capital_injections_BusinessId",
                table: "capital_injections",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_capital_injections_CreatedBy",
                table: "capital_injections",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_capital_injections_PartnerId",
                table: "capital_injections",
                column: "PartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_capital_ledger_BusinessId",
                table: "capital_ledger",
                column: "BusinessId");

            migrationBuilder.CreateIndex(
                name: "IX_capital_ledger_CreatedBy",
                table: "capital_ledger",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_capital_ledger_PartnerId_Bucket_CreatedAt",
                table: "capital_ledger",
                columns: new[] { "PartnerId", "Bucket", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_partners_BusinessId_Phone",
                table: "partners",
                columns: new[] { "BusinessId", "Phone" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "capital_injections");

            migrationBuilder.DropTable(
                name: "capital_ledger");

            migrationBuilder.DropTable(
                name: "partners");
        }
    }
}
