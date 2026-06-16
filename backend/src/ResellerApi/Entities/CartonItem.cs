using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class CartonItem : BaseEntity
{
    public Guid CartonId { get; set; }
    public Guid VariantId { get; set; }
    public decimal QtyInCarton { get; set; }    // discovered when opened
    public decimal QtyLabeled { get; set; }     // labeled so far
    public decimal QtyDamaged { get; set; }     // found damaged when opening
    public decimal LabelPrice { get; set; }     // selling price for THIS label batch

    public Carton Carton { get; set; } = null!;
    public ProductVariant Variant { get; set; } = null!;
}
