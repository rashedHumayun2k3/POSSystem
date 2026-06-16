using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PurchaseReceiveSession : BusinessScopedEntity
{
    public Guid TripId { get; set; }
    public string SessionNo { get; set; } = null!;         // RS-001, RS-002 …
    public Guid ReceivedBy { get; set; }
    public DateTime ReceivedAt { get; set; }               // physical arrival time
    public string TransportMode { get; set; } = null!;     // TRUCK|BUS|AIR|COURIER|BOAT|WALK_IN|OTHER
    public string? VehicleOrTrackingNo { get; set; }
    public string? Note { get; set; }
    public string Status { get; set; } = "PENDING_APPROVAL"; // PENDING_APPROVAL|APPROVED|REJECTED
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectionReason { get; set; }

    public PurchaseTrip Trip { get; set; } = null!;
    public User ReceivedByUser { get; set; } = null!;
    public User? ApprovedByUser { get; set; }
    public ICollection<PurchaseReceiveItem> Items { get; set; } = new List<PurchaseReceiveItem>();
}
