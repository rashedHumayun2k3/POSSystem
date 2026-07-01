using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class OrderStatusHistory : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public string Track { get; set; } = null!; // ORDER|PAYMENT|FULFILLMENT
    public string FromStatus { get; set; } = null!;
    public string ToStatus { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime At { get; set; } = DateTime.UtcNow;
}
