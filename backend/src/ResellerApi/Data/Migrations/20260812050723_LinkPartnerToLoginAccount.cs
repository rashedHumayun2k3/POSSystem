using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class LinkPartnerToLoginAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LinkedUserId",
                table: "partners",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE p
                SET p.LinkedUserId = u.Id
                FROM partners p
                INNER JOIN business_users bu ON bu.BusinessId = p.BusinessId
                INNER JOIN users u ON u.Id = bu.UserId
                WHERE p.PartnerType = 'MANAGING'
                  AND p.LinkedUserId IS NULL
                  AND u.IsActive = 1
                  AND u.Role IN ('OWNER', 'MANAGER')
                  AND LOWER(LTRIM(RTRIM(u.Name))) = LOWER(LTRIM(RTRIM(p.Name)))
                  AND (SELECT COUNT(*)
                       FROM business_users bu2
                       INNER JOIN users u2 ON u2.Id = bu2.UserId
                       WHERE bu2.BusinessId = p.BusinessId
                         AND u2.IsActive = 1
                         AND u2.Role IN ('OWNER', 'MANAGER')
                         AND LOWER(LTRIM(RTRIM(u2.Name))) = LOWER(LTRIM(RTRIM(p.Name)))) = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_partners_BusinessId_LinkedUserId",
                table: "partners",
                columns: new[] { "BusinessId", "LinkedUserId" },
                unique: true,
                filter: "[LinkedUserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_partners_LinkedUserId",
                table: "partners",
                column: "LinkedUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_partners_users_LinkedUserId",
                table: "partners",
                column: "LinkedUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_partners_users_LinkedUserId",
                table: "partners");

            migrationBuilder.DropIndex(
                name: "IX_partners_BusinessId_LinkedUserId",
                table: "partners");

            migrationBuilder.DropIndex(
                name: "IX_partners_LinkedUserId",
                table: "partners");

            migrationBuilder.DropColumn(
                name: "LinkedUserId",
                table: "partners");
        }
    }
}
