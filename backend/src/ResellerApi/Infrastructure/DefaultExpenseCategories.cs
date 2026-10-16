using ResellerApi.Entities;

namespace ResellerApi.Infrastructure;

public static class DefaultExpenseCategories
{
    public static IEnumerable<ExpenseCategory> Create(Guid businessId)
    {
        var categories = new (string Code, string Name)[]
        {
            ("OFFICE", "Office & Admin"),
            ("STAFF", "Staff & Salary"),
            ("MARKETING", "Marketing & Ads"),
            ("DELIVERY", "Delivery & Shipping"),
            ("TRIP", "Trip & Purchase Costs"),
            ("EQUIPMENT_OTHER", "Equipment & Other"),
            ("OWNER_DRAWING", "Owner Drawing"),
            ("INVENTORY_LOSS", "Inventory & Stock Loss"),
            ("SETUP_CAPEX", "Initial Setup & Assets")
        };
        return categories.Select(category => new ExpenseCategory
        {
            BusinessId = businessId, Code = category.Code, Name = category.Name,
            IsSystem = true, IsDefault = category.Code == "OFFICE", IsActive = true
        });
    }
}
