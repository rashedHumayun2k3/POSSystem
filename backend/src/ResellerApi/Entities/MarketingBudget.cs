using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class MarketingBudget : BusinessScopedEntity
{
    public int Year { get; set; }
    public int Month { get; set; }          // 1–12

    public string Scope { get; set; } = null!;   // BUSINESS | CATEGORY | PRODUCT
    public Guid? ScopeId { get; set; }

    public decimal BudgetAmount { get; set; }

    public Guid SetBy { get; set; }
    public User SetByUser { get; set; } = null!;
}
