using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class SupplierReturnItem : BaseEntity
{
    public Guid ReturnId { get; set; }
    public SupplierReturn Return { get; set; } = null!;

    public Guid VariantId { get; set; }
    public ProductVariant Variant { get; set; } = null!;

    public decimal QtyReturned { get; set; }
    public decimal UnitCost { get; set; } // the landed cost of the damaged batch

    public string ResolutionType { get; set; } = null!; // REFUND | REPLACEMENT | CREDIT_NOTE | WRITE_OFF
    public decimal? ResolutionAmount { get; set; }       // money received back (REFUND / CREDIT_NOTE)

    public Guid? ReplacementTripId { get; set; }          // if supplier sends replacement goods
    public PurchaseTrip? ReplacementTrip { get; set; }

    public string? Note { get; set; }
}
