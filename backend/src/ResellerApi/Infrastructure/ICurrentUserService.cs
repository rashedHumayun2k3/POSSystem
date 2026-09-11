namespace ResellerApi.Infrastructure;

public interface ICurrentUserService
{
    Guid UserId { get; }
    string Role { get; }
    bool IsOwner { get; }
    bool IsManager { get; }
    bool IsPartner { get; }
    bool IsWarehouse { get; }
    bool IsStaff { get; }
    bool CanSeeCosts { get; }
    bool CanAccessAllBranches { get; }
    bool CanAccessPos { get; }
}
