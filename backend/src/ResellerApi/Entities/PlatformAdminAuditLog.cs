using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PlatformAdminAuditLog : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string Action { get; set; } = null!; // DEACTIVATE_COMPANY | ACTIVATE_COMPANY | EXTEND_SUBSCRIPTION
    public string? Note { get; set; }
    public string? DetailsJson { get; set; }
}
