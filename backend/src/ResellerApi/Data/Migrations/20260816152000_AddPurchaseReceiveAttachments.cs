using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ResellerApi.Data;

#nullable disable

namespace ResellerApi.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260816152000_AddPurchaseReceiveAttachments")]
public partial class AddPurchaseReceiveAttachments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "AttachmentsJson",
            table: "purchase_receive_sessions",
            type: "nvarchar(max)",
            nullable: false,
            defaultValue: "[]");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "AttachmentsJson", table: "purchase_receive_sessions");
    }
}
