using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class SuggestedCategoryField : BaseEntity
{
    public Guid SuggestedCategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string FieldType { get; set; } = null!; // TEXT, NUMBER, DATE, DROPDOWN, BOOLEAN
    public string? OptionsJson { get; set; }
    public bool IsRequired { get; set; }
    public bool IsVariant { get; set; }
    public bool IsPerLot { get; set; }
    public int SortOrder { get; set; }

    public SuggestedCategory SuggestedCategory { get; set; } = null!;
}
