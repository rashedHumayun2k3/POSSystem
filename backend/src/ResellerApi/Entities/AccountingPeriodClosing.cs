using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class AccountingPeriodClosing : BusinessScopedEntity
{
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public long OpeningBalancePaisa { get; set; }
    public long ApprovedCashPaisa { get; set; }
    public long BusinessExpensePaisa { get; set; }
    public long ClosingBalancePaisa { get; set; }
    public string Status { get; set; } = "CLOSED";
    public string? Note { get; set; }
    public Guid ClosedBy { get; set; }
    public DateTime ClosedAt { get; set; }
}
