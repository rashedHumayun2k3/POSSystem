using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Category : BusinessScopedEntity
{
    public string Name { get; set; } = null!;
    // Optional Bangla display name — shown instead of Name when the staff app's language toggle
    // is set to বাংলা (see LanguageContext in /frontend). Falls back to Name when not set.
    public string? NameBn { get; set; }
    public string DefaultUnit { get; set; } = "pcs";

    // Set when this category was created from a suggested-category template (onboarding
    // preset, or the "Catalog Templates" picker). Null for fully custom categories. Survives
    // renames — lets suggested-product lookups stay accurate without string matching on Name.
    public Guid? SuggestedCategoryId { get; set; }

    // Single-level only (a subcategory can't itself have subcategories) — enforced in
    // CategoryService, not the database. A subcategory has no Fields of its own; it always
    // inherits its parent's, so custom-field setup only ever needs to happen once per top-level
    // category.
    public Guid? ParentCategoryId { get; set; }
    public Category? ParentCategory { get; set; }
    public ICollection<Category> Subcategories { get; set; } = new List<Category>();

    public ICollection<CategoryField> Fields { get; set; } = new List<CategoryField>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
