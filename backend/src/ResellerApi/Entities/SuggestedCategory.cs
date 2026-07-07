using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// Global template catalog — NOT business-scoped. Every business reads the same rows;
// picking from this list COPIES values into a new real Category row, never consumes them.
public class SuggestedCategory : BaseEntity
{
    public string BusinessTypeCode { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string DefaultUnit { get; set; } = null!;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<SuggestedCategoryField> Fields { get; set; } = new List<SuggestedCategoryField>();
    public ICollection<SuggestedProduct> Products { get; set; } = new List<SuggestedProduct>();
}
