using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ExternalOrderIntegration : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string KeyHash { get; set; } = null!;
    public string? SourceWebsiteUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid CreatedBy { get; set; }
    public User CreatedByUser { get; set; } = null!;
}
