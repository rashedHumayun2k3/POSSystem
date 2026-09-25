using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ShippingCompany : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? LocalAddress { get; set; }
    public string? ChinaAddress { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<ShippingCompanyRate> Rates { get; set; } = new List<ShippingCompanyRate>();
}
