namespace ResellerApi.Infrastructure;

public interface IBusinessContext
{
    Guid CurrentBusinessId { get; }
}
