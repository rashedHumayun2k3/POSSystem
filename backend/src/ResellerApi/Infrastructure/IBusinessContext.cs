namespace ResellerApi.Infrastructure;

public interface IBusinessContext
{
    Guid CurrentBusinessId { get; }
    Guid? CurrentBranchId { get; }
}
