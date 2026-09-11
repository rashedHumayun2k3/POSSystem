using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class CourierRemittance : BusinessScopedEntity
{
    public string RemittanceNo { get; set; } = null!;
    public Guid CourierId { get; set; }
    public Courier Courier { get; set; } = null!;
    public decimal Amount { get; set; }
    public DateTime RemittedAt { get; set; }
    public string Method { get; set; } = null!; // BANK|BKASH|NAGAD|CASH
    public string? Reference { get; set; }       // bKash TrxID / bank reference
    public string? Note { get; set; }
    public Guid RecordedBy { get; set; }
    public User RecordedByUser { get; set; } = null!;

    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
