using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ResellerApi.Data;

#nullable disable

namespace ResellerApi.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260815113000_PersistExactShopType")]
public partial class PersistExactShopType : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "ShopType",
            table: "businesses",
            type: "nvarchar(30)",
            maxLength: 30,
            nullable: true);

        migrationBuilder.Sql(
            """
            UPDATE businesses
            SET ShopType = CASE
                WHEN SalesChannelsJson LIKE '%"POS"%' THEN 'BIG_SUPERSHOP'
                WHEN SalesChannelsJson LIKE '%"HAWKER"%' THEN 'HAWKER_SHOP'
                ELSE NULL
            END
            WHERE ShopType IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "ShopType",
            table: "businesses");
    }
}
