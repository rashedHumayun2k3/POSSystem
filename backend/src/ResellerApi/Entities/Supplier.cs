using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Supplier : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Notes { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public int UsageCount { get; set; }
}
