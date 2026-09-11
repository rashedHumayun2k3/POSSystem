using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ProductMarketplaceDetail : BusinessScopedEntity
{
    public Guid ProductId { get; set; }
    public string Section { get; set; } = null!; // STYLE | FEATURES_SPECS | ITEM_DETAILS
    public string Label { get; set; } = null!;
    public string Value { get; set; } = null!;
    public int SortOrder { get; set; }

    public Product Product { get; set; } = null!;
}
