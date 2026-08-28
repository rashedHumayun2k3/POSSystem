using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    [Migration("20260824000100_AddBusinessStorefrontTheme")]
    public partial class AddBusinessStorefrontTheme : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StorefrontThemeId",
                table: "businesses",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "clean-light");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StorefrontThemeId",
                table: "businesses");
        }
    }
}
