namespace ResellerApi.Entities;

// Plain entities: the worker operates across tenants; API queries explicitly scope access.
public class OrderNotificationEvent
{
    public Guid OrderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
}

public class OrderNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public Guid BusinessId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid RecipientId { get; set; }
    public string OrderNo { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}

public class PushDevice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Token { get; set; } = "";
    public Guid UserId { get; set; }
    public Guid BusinessId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid RefreshTokenId { get; set; }
    public string Language { get; set; } = "bn";
    public bool Enabled { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class OrderPushDelivery
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid NotificationId { get; set; }
    public OrderNotification Notification { get; set; } = null!;
    public Guid DeviceId { get; set; }
    public PushDevice Device { get; set; } = null!;
    public string? TicketId { get; set; }
    public string State { get; set; } = "PENDING";
    public int Attempts { get; set; }
    public DateTime NextAttemptAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public string? LastError { get; set; }
}
