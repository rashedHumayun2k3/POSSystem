using Microsoft.EntityFrameworkCore;
using ResellerApi.Entities;

namespace ResellerApi.Data;

internal static class OrderNotificationModel
{
    public static void Configure(ModelBuilder model)
    {
        model.Entity<OrderNotificationEvent>(e => {
            e.ToTable("order_notification_events"); e.HasKey(x => x.OrderId);
            e.HasOne<Order>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ProcessedAt, x.CreatedAt });
        });
        model.Entity<OrderNotification>(e => {
            e.ToTable("order_notifications"); e.Property(x => x.OrderNo).HasMaxLength(100);
            e.HasIndex(x => new { x.OrderId, x.RecipientId }).IsUnique();
            e.HasIndex(x => new { x.BusinessId, x.RecipientId, x.ReadAt, x.CreatedAt });
            e.HasOne<Order>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.RecipientId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PushDevice>(e => {
            e.ToTable("push_devices"); e.Property(x => x.Token).HasMaxLength(250);
            e.Property(x => x.Language).HasMaxLength(5);
            e.HasIndex(x => x.Token).IsUnique();
            e.HasIndex(x => new { x.BusinessId, x.UserId, x.Enabled });
            e.HasIndex(x => x.RefreshTokenId);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<OrderPushDelivery>(e => {
            e.ToTable("order_push_deliveries"); e.Property(x => x.State).HasMaxLength(20);
            e.Property(x => x.TicketId).HasMaxLength(100); e.Property(x => x.LastError).HasMaxLength(100);
            e.HasIndex(x => new { x.NotificationId, x.DeviceId }).IsUnique();
            e.HasIndex(x => new { x.State, x.NextAttemptAt });
            e.HasOne(x => x.Notification).WithMany().HasForeignKey(x => x.NotificationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Device).WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
