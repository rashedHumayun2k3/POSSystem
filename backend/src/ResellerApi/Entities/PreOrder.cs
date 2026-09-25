using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PreOrder : BusinessScopedEntity, IBranchScoped
{
    public Guid? BranchId { get; set; }
    public string PreOrderNo { get; set; } = null!;
    public string Source { get; set; } = "POS";
    public string Status { get; set; } = "WAITING_STOCK";
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public string? CustomerEmail { get; set; }
    public string? CustomerReference { get; set; }
    public string? CustomerNote { get; set; }
    public string? StaffNote { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpectedDate { get; set; }
    public DateTime? PickupDeadline { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    public Branch? Branch { get; set; }
    public User CreatedByUser { get; set; } = null!;
    public ICollection<PreOrderItem> Items { get; set; } = new List<PreOrderItem>();
}
