using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Business : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = null!;
    public string Currency { get; set; } = "BDT";

    public Company Company { get; set; } = null!;
    public ICollection<BusinessUser> BusinessUsers { get; set; } = new List<BusinessUser>();
}
