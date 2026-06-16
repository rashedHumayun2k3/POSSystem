using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Category : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string DefaultUnit { get; set; } = "pcs";

    public ICollection<CategoryField> Fields { get; set; } = new List<CategoryField>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
