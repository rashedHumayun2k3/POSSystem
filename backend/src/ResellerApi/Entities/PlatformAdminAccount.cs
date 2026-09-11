using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PlatformAdminAccount : BaseEntity
{
    public string Username { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public bool IsActive { get; set; } = true;
}
