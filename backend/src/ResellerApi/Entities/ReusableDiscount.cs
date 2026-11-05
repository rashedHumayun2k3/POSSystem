using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

/// <summary>A reusable business discount definition. Applications create normal variant price slots.</summary>
public class ReusableDiscount : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public decimal Percent { get; set; }
    public string? Reason { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public Guid CreatedBy { get; set; }
    public bool IsArchived { get; set; }

    public User CreatedByUser { get; set; } = null!;
    public ICollection<PriceSlot> Applications { get; set; } = new List<PriceSlot>();
}
