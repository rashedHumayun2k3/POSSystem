using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ResellerApi.Data;

#nullable disable

namespace ResellerApi.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260816143000_AddPurchaseMissingQuantities")]
public partial class AddPurchaseMissingQuantities : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "QtyMissing",
            table: "purchase_items",
            type: "DECIMAL(12,3)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "QtyMissing",
            table: "purchase_receive_session_items",
            type: "DECIMAL(12,3)",
            nullable: false,
            defaultValue: 0m);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "QtyMissing", table: "purchase_items");
        migrationBuilder.DropColumn(name: "QtyMissing", table: "purchase_receive_session_items");
    }
}
