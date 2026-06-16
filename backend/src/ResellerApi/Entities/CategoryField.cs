using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class CategoryField : BaseEntity
{
    public Guid CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string FieldType { get; set; } = null!; // TEXT, NUMBER, DATE, DROPDOWN, BOOLEAN
    public string? OptionsJson { get; set; }        // JSON array for DROPDOWN options
    public bool IsRequired { get; set; } = false;
    public bool IsVariant { get; set; } = false;    // splits stock per value
    public bool IsPerLot { get; set; } = false;     // entered per purchase batch
    public int SortOrder { get; set; } = 0;

    public Category Category { get; set; } = null!;
}
