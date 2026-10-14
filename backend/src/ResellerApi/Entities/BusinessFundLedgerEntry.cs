using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class BusinessFundLedgerEntry : BusinessScopedEntity
{
    public Guid ClosingId { get; set; }
    public DateTime PostingDate { get; set; }
    public DateTime OriginalDate { get; set; }
    public string MovementType { get; set; } = null!;
    public long AmountPaisa { get; set; }
    public string SourceType { get; set; } = null!;
    public Guid SourceId { get; set; }
    public Guid CreatedBy { get; set; }
    public Guid? ReversalOfId { get; set; }
}
