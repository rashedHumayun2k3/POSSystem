namespace ResellerApi.Infrastructure;

public class BusinessContext : IBusinessContext
{
    public Guid CurrentBusinessId { get; set; }
    public Guid? CurrentBranchId { get; set; }
}
