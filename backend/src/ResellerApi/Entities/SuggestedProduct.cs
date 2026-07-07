using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// Global template catalog — NOT business-scoped, keyed by SuggestedCategory (not by business
// type directly), so lookup is precise even after the real category gets renamed.
public class SuggestedProduct : BaseEntity
{
    public Guid SuggestedCategoryId { get; set; }
    public string Name { get; set; } = null!;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public SuggestedCategory SuggestedCategory { get; set; } = null!;
}
