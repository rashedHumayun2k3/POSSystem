using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class BusinessTypes_MultiSelect : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BusinessTypesJson",
                table: "businesses",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            // Backfill: wrap the existing single BusinessType value into a one-element JSON array.
            migrationBuilder.Sql(
                "UPDATE businesses SET BusinessTypesJson = CONCAT('[\"', BusinessType, '\"]') WHERE BusinessType IS NOT NULL;");

            migrationBuilder.DropColumn(
                name: "BusinessType",
                table: "businesses");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BusinessType",
                table: "businesses",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            // Best-effort backfill: take the first element of the JSON array.
            migrationBuilder.Sql(
                "UPDATE b SET b.BusinessType = j.[value] FROM businesses b " +
                "CROSS APPLY (SELECT TOP 1 [value] FROM OPENJSON(b.BusinessTypesJson)) j " +
                "WHERE b.BusinessTypesJson IS NOT NULL;");

            migrationBuilder.DropColumn(
                name: "BusinessTypesJson",
                table: "businesses");
        }
    }
}
