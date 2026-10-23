using ResellerApi.Entities.Base;
namespace ResellerApi.Entities;
public class Brand : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
}
