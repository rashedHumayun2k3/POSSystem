using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ProductImage : BusinessScopedEntity
{
    public Guid ProductId { get; set; }
    public string ImageUrl { get; set; } = null!;
    public int SortOrder { get; set; }

    public Product Product { get; set; } = null!;
}
