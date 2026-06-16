namespace ResellerApi.Entities.Base;

public abstract class BusinessScopedEntity : BaseEntity
{
    public Guid BusinessId { get; set; }
    public Business Business { get; set; } = null!;
}
