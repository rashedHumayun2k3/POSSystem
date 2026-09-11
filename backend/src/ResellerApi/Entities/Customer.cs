using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Customer : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string? Address { get; set; }
    public string? PhotoUrl { get; set; }
    public decimal CreditLimit { get; set; }
    public decimal StoreCreditBalance { get; set; }
    public bool IsRejecterFlag { get; set; }
    public bool IsClaimerFlag { get; set; }
    public string? Note { get; set; }

    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
