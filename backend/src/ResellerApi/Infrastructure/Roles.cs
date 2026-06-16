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
}
