using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Company : BaseEntity
{
    public string Name { get; set; } = null!;
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, SUSPENDED, TRIAL

    public ICollection<Business> Businesses { get; set; } = new List<Business>();
    public ICollection<User> Users { get; set; } = new List<User>();
}
