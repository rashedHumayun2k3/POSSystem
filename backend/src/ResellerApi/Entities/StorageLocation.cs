using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class StorageLocation : BusinessScopedEntity, IBranchScoped
{
    public Guid? BranchId { get; set; }
    public string Name { get; set; } = null!;
    public string LocationType { get; set; } = null!; // ShopFloor | StoreRoom | DamageArea | ReturnArea
    public bool IsActive { get; set; } = true;

    public Branch? Branch { get; set; }
}
