namespace ResellerApi.Infrastructure;

public static class Roles
{
    public const string Owner     = "OWNER";
    public const string Manager   = "MANAGER";
    public const string Staff     = "STAFF";
    public const string Warehouse = "WAREHOUSE";

    public static readonly IReadOnlySet<string> All =
        new HashSet<string> { Owner, Manager, Staff, Warehouse };

    public const string OwnerOrManager          = "OWNER,MANAGER";
    public const string OwnerManagerWarehouse   = "OWNER,MANAGER,WAREHOUSE";
    public const string OwnerWarehouse          = "OWNER,WAREHOUSE";

    // Platform-level role, not a tenant role: minted only by PlatformAdminService.LoginAsync,
    // never assignable to a User row, so it's deliberately excluded from `All`.
    public const string PlatformAdmin = "PLATFORM_ADMIN";

    // ClientPage reviewer identity, minted only by ClientPageAuthService.GoogleLoginAsync for a
    // ClientPageCustomerAccount — not a tenant role, deliberately excluded from `All`.
    public const string ClientPageCustomer = "CLIENTPAGE_CUSTOMER";
}
