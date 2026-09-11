using System.Security.Claims;

namespace ResellerApi.Infrastructure;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid UserId =>
        Guid.Parse(_httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());

    public string Role =>
        _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    public bool IsOwner     => Role == Roles.Owner;
    public bool IsManager   => Role == Roles.Manager;
    public bool IsPartner   => Role == Roles.Partner;
    public bool IsWarehouse => Role == Roles.Warehouse;
    public bool IsStaff     => Role == Roles.Staff;
    public bool CanSeeCosts => IsOwner || IsManager;
    public bool CanAccessAllBranches => IsOwner || IsManager || IsPartner;
    public bool CanAccessPos => string.Equals(
        _httpContextAccessor.HttpContext?.User.FindFirstValue("can_access_pos"), "true",
        StringComparison.OrdinalIgnoreCase);
}
