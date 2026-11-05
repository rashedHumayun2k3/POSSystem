using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "order_notification_events",
                columns: table => new
                {
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_notification_events", x => x.OrderId);
                    table.ForeignKey(
                        name: "FK_order_notification_events_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RecipientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_order_notifications_orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_order_notifications_users_RecipientId",
                        column: x => x.RecipientId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "push_devices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BranchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RefreshTokenId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Language = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_push_devices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_push_devices_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "order_push_deliveries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NotificationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TicketId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    State = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_push_deliveries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_order_push_deliveries_order_notifications_NotificationId",
                        column: x => x.NotificationId,
                        principalTable: "order_notifications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_order_push_deliveries_push_devices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "push_devices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_order_notification_events_ProcessedAt_CreatedAt",
                table: "order_notification_events",
                columns: new[] { "ProcessedAt", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_order_notifications_BusinessId_RecipientId_ReadAt_CreatedAt",
                table: "order_notifications",
                columns: new[] { "BusinessId", "RecipientId", "ReadAt", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_order_notifications_OrderId_RecipientId",
                table: "order_notifications",
                columns: new[] { "OrderId", "RecipientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_order_notifications_RecipientId",
                table: "order_notifications",
                column: "RecipientId");

            migrationBuilder.CreateIndex(
                name: "IX_order_push_deliveries_DeviceId",
                table: "order_push_deliveries",
                column: "DeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_order_push_deliveries_NotificationId_DeviceId",
                table: "order_push_deliveries",
                columns: new[] { "NotificationId", "DeviceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_order_push_deliveries_State_NextAttemptAt",
                table: "order_push_deliveries",
                columns: new[] { "State", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_push_devices_BusinessId_UserId_Enabled",
                table: "push_devices",
                columns: new[] { "BusinessId", "UserId", "Enabled" });

            migrationBuilder.CreateIndex(
                name: "IX_push_devices_RefreshTokenId",
                table: "push_devices",
                column: "RefreshTokenId");

            migrationBuilder.CreateIndex(
                name: "IX_push_devices_Token",
                table: "push_devices",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_push_devices_UserId",
                table: "push_devices",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "order_notification_events");

            migrationBuilder.DropTable(
                name: "order_push_deliveries");

            migrationBuilder.DropTable(
                name: "order_notifications");

            migrationBuilder.DropTable(
                name: "push_devices");
        }
    }
}
