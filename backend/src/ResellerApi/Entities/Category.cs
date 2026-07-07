using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Category : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    public string DefaultUnit { get; set; } = "pcs";

    // Set when this category was created from a suggested-category template (onboarding
    // preset, or the "Catalog Templates" picker). Null for fully custom categories. Survives
    // renames — lets suggested-product lookups stay accurate without string matching on Name.
    public Guid? SuggestedCategoryId { get; set; }

    public ICollection<CategoryField> Fields { get; set; } = new List<CategoryField>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
