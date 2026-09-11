using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFacebookLoginSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_client_page_customer_accounts_GoogleId",
                table: "client_page_customer_accounts");

            migrationBuilder.AlterColumn<string>(
                name: "GoogleId",
                table: "client_page_customer_accounts",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "client_page_customer_accounts",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255);

            migrationBuilder.AddColumn<string>(
                name: "FacebookId",
                table: "client_page_customer_accounts",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_client_page_customer_accounts_FacebookId",
                table: "client_page_customer_accounts",
                column: "FacebookId",
                unique: true,
                filter: "[FacebookId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_client_page_customer_accounts_GoogleId",
                table: "client_page_customer_accounts",
                column: "GoogleId",
                unique: true,
                filter: "[GoogleId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_client_page_customer_accounts_FacebookId",
                table: "client_page_customer_accounts");

            migrationBuilder.DropIndex(
                name: "IX_client_page_customer_accounts_GoogleId",
                table: "client_page_customer_accounts");

            migrationBuilder.DropColumn(
                name: "FacebookId",
                table: "client_page_customer_accounts");

            migrationBuilder.AlterColumn<string>(
                name: "GoogleId",
                table: "client_page_customer_accounts",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "client_page_customer_accounts",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_client_page_customer_accounts_GoogleId",
                table: "client_page_customer_accounts",
                column: "GoogleId",
                unique: true);
        }
    }
}
