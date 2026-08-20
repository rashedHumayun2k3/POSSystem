using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ResellerApi.Data;

#nullable disable

namespace ResellerApi.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260816120000_AddPurchaseItemWeight")]
public partial class AddPurchaseItemWeight : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "UnitWeightGrams",
            table: "purchase_items",
            type: "DECIMAL(14,3)",
            nullable: false,
            defaultValue: 0m);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "UnitWeightGrams",
            table: "purchase_items");
    }
}
