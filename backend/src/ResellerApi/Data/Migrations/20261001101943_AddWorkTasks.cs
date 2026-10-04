using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanCommentAllTasks",
                table: "business_users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanManageAllTasks",
                table: "business_users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanViewAllTasks",
                table: "business_users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "work_tasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", maxLength: 10000, nullable: true),
                    CreatorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssigneeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DueAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Priority = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CompletedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_tasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_work_tasks_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_tasks_users_AssigneeId",
                        column: x => x.AssigneeId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_tasks_users_CompletedById",
                        column: x => x.CompletedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_tasks_users_CreatorId",
                        column: x => x.CreatorId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "task_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(max)", maxLength: 24000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_task_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_task_entries_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_task_entries_users_ActorId",
                        column: x => x.ActorId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_task_entries_work_tasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "work_tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "task_notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecipientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ReadAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RowVer = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    BusinessId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_task_notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_task_notifications_businesses_BusinessId",
                        column: x => x.BusinessId,
                        principalTable: "businesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_task_notifications_users_RecipientId",
                        column: x => x.RecipientId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_task_notifications_work_tasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "work_tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_task_entries_ActorId",
                table: "task_entries",
                column: "ActorId");

            migrationBuilder.CreateIndex(
                name: "IX_task_entries_BusinessId_TaskId_CreatedAt",
                table: "task_entries",
                columns: new[] { "BusinessId", "TaskId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_task_entries_TaskId",
                table: "task_entries",
                column: "TaskId");

            migrationBuilder.CreateIndex(
                name: "IX_task_notifications_BusinessId_RecipientId_ReadAt_CreatedAt",
                table: "task_notifications",
                columns: new[] { "BusinessId", "RecipientId", "ReadAt", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_task_notifications_RecipientId",
                table: "task_notifications",
                column: "RecipientId");

            migrationBuilder.CreateIndex(
                name: "IX_task_notifications_TaskId",
                table: "task_notifications",
                column: "TaskId");

            migrationBuilder.CreateIndex(
                name: "IX_work_tasks_AssigneeId",
                table: "work_tasks",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_work_tasks_BusinessId_AssigneeId_Status_DueAt",
                table: "work_tasks",
                columns: new[] { "BusinessId", "AssigneeId", "Status", "DueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_work_tasks_BusinessId_CreatorId_Status",
                table: "work_tasks",
                columns: new[] { "BusinessId", "CreatorId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_work_tasks_BusinessId_Status_DueAt",
                table: "work_tasks",
                columns: new[] { "BusinessId", "Status", "DueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_work_tasks_CompletedById",
                table: "work_tasks",
                column: "CompletedById");

            migrationBuilder.CreateIndex(
                name: "IX_work_tasks_CreatorId",
                table: "work_tasks",
                column: "CreatorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "task_entries");

            migrationBuilder.DropTable(
                name: "task_notifications");

            migrationBuilder.DropTable(
                name: "work_tasks");

            migrationBuilder.DropColumn(
                name: "CanCommentAllTasks",
                table: "business_users");

            migrationBuilder.DropColumn(
                name: "CanManageAllTasks",
                table: "business_users");

            migrationBuilder.DropColumn(
                name: "CanViewAllTasks",
                table: "business_users");
        }
    }
}
