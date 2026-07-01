using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Order : BusinessScopedEntity
{
    public string OrderNo { get; set; } = null!;
    public string Channel { get; set; } = null!; // FACEBOOK|WHATSAPP|INSTAGRAM|PHONE|SHOP|OTHER

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string CustomerName { get; set; } = null!;
    public string CustomerPhone { get; set; } = null!;
    public string? CustomerAddress { get; set; }

    // 3 independent status tracks
    public string OrderStatus { get; set; } = "OPEN";           // OPEN|COMPLETED|CANCELLED
    public string PaymentStatus { get; set; } = "UNPAID";       // UNPAID|PARTIALLY_PAID|PAID|REFUNDED
    public string FulfillmentStatus { get; set; } = "UNFULFILLED"; // UNFULFILLED|PACKED|IN_TRANSIT|DELIVERED|RETURNED

    public bool IsDraft { get; set; }

    public string? DiscountType { get; set; }   // PERCENT|FIXED
    public decimal? DiscountValue { get; set; }

    public decimal DeliveryChargeCustomer { get; set; }
    public decimal DeliveryCostActual { get; set; }

    public Guid? CourierId { get; set; }
    public Courier? Courier { get; set; }
    public Guid? DeliveryManId { get; set; }
    public DeliveryMan? DeliveryMan { get; set; }
    public string? TrackingNo { get; set; }

    public decimal AdvancePaid { get; set; }

    public Guid? HandlingUserId { get; set; }
    public User? HandlingUser { get; set; }

    public string? ClientUid { get; set; }

    public Guid CreatedBy { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public DateTime? ConfirmedAt { get; set; }
    public DateTime? HandedOverAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public string? CancelledReason { get; set; }

    public string? Note { get; set; }

    // Return resolution
    public string? ReturnResolution { get; set; }  // COURIER_RETURN|REFUND|STORE_CREDIT|REPLACE_SAME|EXCHANGE_DIFFERENT
    public string? ReturnReason { get; set; }       // DEFECTIVE|WRONG_SIZE_COLOR|CHANGED_MIND|DAMAGED_DELIVERY|OTHER
    public string? ReturnNote { get; set; }

    public Guid? RemittanceId { get; set; }
    public CourierRemittance? Remittance { get; set; }
    public string? CodRemittanceStatus { get; set; } // PENDING | REMITTED | NOT_APPLICABLE

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<OrderStatusHistory> StatusHistory { get; set; } = new List<OrderStatusHistory>();
    public ICollection<OrderPayment> Payments { get; set; } = new List<OrderPayment>();
}
