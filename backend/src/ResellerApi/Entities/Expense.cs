using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Expense : BusinessScopedEntity
{
    public Guid CategoryId { get; set; }
    public ExpenseCategory Category { get; set; } = null!;

    public string SubType { get; set; } = null!;         // free text sub-category
    public decimal Amount { get; set; }
    public DateTime ExpenseDate { get; set; }

    public Guid? StaffId { get; set; }                   // relevant for salary entries
    public User? Staff { get; set; }

    public bool IsRecurring { get; set; }
    public int? RecurringDay { get; set; }               // day of month for auto-creation

    public Guid? AllocateToTripId { get; set; }          // attach to purchase trip shared costs
    public PurchaseTrip? AllocateToTrip { get; set; }

    public Guid? PettyCashBoxId { get; set; }            // paid from petty cash box
    public PettyCashBox? PettyCashBox { get; set; }

    public string? PhotoUrl { get; set; }

    // PENDING = awaiting owner approval (staff entries); APPROVED; REJECTED
    public string Status { get; set; } = "APPROVED";
    public DateTime? PaidAt { get; set; }

    public Guid CreatedBy { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public Guid? ApprovedBy { get; set; }
    public User? ApprovedByUser { get; set; }

    public string? Note { get; set; }
    public string? RejectionReason { get; set; }
}
