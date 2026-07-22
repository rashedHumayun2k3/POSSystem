using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class EmailVerification_AddPurpose : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_email_verifications_Email",
                table: "email_verifications");

            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                table: "email_verifications",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "SIGNUP");

            migrationBuilder.CreateIndex(
                name: "IX_email_verifications_Email_Purpose",
                table: "email_verifications",
                columns: new[] { "Email", "Purpose" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_email_verifications_Email_Purpose",
                table: "email_verifications");

            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "email_verifications");

            migrationBuilder.CreateIndex(
                name: "IX_email_verifications_Email",
                table: "email_verifications",
                column: "Email");
        }
    }
}
