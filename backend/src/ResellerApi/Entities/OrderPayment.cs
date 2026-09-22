using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class OrderPayment : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public string Method { get; set; } = null!; // CASH|BKASH|NAGAD|CARD|BAKI|STORE_CREDIT|COD
    public decimal Amount { get; set; }
    public string? PaymentReference { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
}
