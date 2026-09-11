using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ResellerApi.Data;

#nullable disable

namespace ResellerApi.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260816160000_AddPurchaseTripAttachments")]
public partial class AddPurchaseTripAttachments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "AttachmentsJson",
            table: "purchase_trips",
            type: "nvarchar(max)",
            nullable: false,
            defaultValue: "[]");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "AttachmentsJson", table: "purchase_trips");
    }
}
