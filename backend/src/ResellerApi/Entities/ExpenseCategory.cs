using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ExpenseCategory : BusinessScopedEntity
{
    public string Code { get; set; } = null!;   // OFFICE|STAFF|MARKETING|DELIVERY|TRIP|EQUIPMENT_OTHER|OWNER_DRAWING|CUSTOM_*
    public string Name { get; set; } = null!;
    public bool IsSystem { get; set; } = false;  // system categories cannot be deleted
    public bool IsDefault { get; set; } = false;
    public bool IsActive { get; set; } = true;

    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
}
