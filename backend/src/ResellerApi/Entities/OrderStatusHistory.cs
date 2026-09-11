using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class OrderStatusHistory : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public string Track { get; set; } = null!; // ORDER|PAYMENT|FULFILLMENT|ITEMS
    public string FromStatus { get; set; } = null!;
    public string ToStatus { get; set; } = null!;

    // Only populated for Track="ITEMS" (order revision) rows — why a product qty/removal
    // change happened, for later sales-history review. Reason is a fixed dropdown vocabulary
    // (OUT_OF_STOCK|CUSTOMER_CHANGED_MIND|OTHER) so it stays reportable; Note is free text,
    // required only when Reason is OTHER.
    public string? Reason { get; set; }
    public string? Note { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime At { get; set; } = DateTime.UtcNow;
}
