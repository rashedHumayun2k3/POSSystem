using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// Append-only per GTR-7 — never updated in place; new row with new effective_from
public class PlannedRate : BusinessScopedEntity
{
    public string Scope { get; set; } = null!;      // BUSINESS | CATEGORY | PRODUCT
    public Guid? ScopeId { get; set; }              // null when Scope = BUSINESS

    public string RateType { get; set; } = null!;   // MARKETING | OVERHEAD
    public decimal RatePerUnit { get; set; }

    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }      // null = currently active

    public Guid SetBy { get; set; }
    public User SetByUser { get; set; } = null!;
}
