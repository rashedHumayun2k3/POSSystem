using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ExpenseCategory : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public bool IsDefault { get; set; } = false;
    public bool IsActive { get; set; } = true;
}
