using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class StockMovement : BusinessScopedEntity, IBranchScoped
{
    public Guid? BranchId { get; set; }
    public Branch? Branch { get; set; }
    public Guid VariantId { get; set; }
    public string MovementType { get; set; } = null!; // PURCHASE_IN | SALE_OUT | RETURN_IN | DAMAGE_IN | DAMAGE_OUT | REPAIR_IN | WRITE_OFF | ADJUSTMENT | COMMIT | RELEASE
    public decimal Qty { get; set; }                  // signed
    public Guid? LotId { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public Guid UserId { get; set; }
    public string? Note { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public Lot? Lot { get; set; }
    public User User { get; set; } = null!;
}
