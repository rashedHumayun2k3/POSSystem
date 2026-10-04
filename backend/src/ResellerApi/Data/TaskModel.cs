using Microsoft.EntityFrameworkCore;
using ResellerApi.Entities;

namespace ResellerApi.Data;

internal static class TaskModel
{
    public static void Configure(ModelBuilder model)
    {
        model.Entity<WorkTask>(e =>
        {
            e.ToTable("work_tasks");
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Description).HasMaxLength(10000);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.Priority).HasMaxLength(10);
            e.HasOne(x => x.Business).WithMany().HasForeignKey(x => x.BusinessId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Creator).WithMany().HasForeignKey(x => x.CreatorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Assignee).WithMany().HasForeignKey(x => x.AssigneeId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CompletedBy).WithMany().HasForeignKey(x => x.CompletedById).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.BusinessId, x.AssigneeId, x.Status, x.DueAt });
            e.HasIndex(x => new { x.BusinessId, x.CreatorId, x.Status });
            e.HasIndex(x => new { x.BusinessId, x.Status, x.DueAt });
        });
        model.Entity<TaskEntry>(e =>
        {
            e.ToTable("task_entries");
            e.Property(x => x.Kind).HasMaxLength(30);
            e.Property(x => x.Message).HasMaxLength(24000);
            e.HasOne(x => x.Business).WithMany().HasForeignKey(x => x.BusinessId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Task).WithMany().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Actor).WithMany().HasForeignKey(x => x.ActorId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.BusinessId, x.TaskId, x.CreatedAt });
        });
        model.Entity<TaskNotification>(e =>
        {
            e.ToTable("task_notifications");
            e.Property(x => x.Message).HasMaxLength(500);
            e.HasOne(x => x.Business).WithMany().HasForeignKey(x => x.BusinessId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Task).WithMany().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Recipient).WithMany().HasForeignKey(x => x.RecipientId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.BusinessId, x.RecipientId, x.ReadAt, x.CreatedAt });
        });
    }
}
