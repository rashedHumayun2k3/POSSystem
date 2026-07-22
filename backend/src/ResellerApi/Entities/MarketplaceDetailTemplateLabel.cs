using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// A per-category library of Style / Features & Specs / Item Details labels. Seeded once from the
// curated vertical templates (Clothing, Electronics, Footwear, ...) when a category is created or
// backfilled, then grows further as sellers save marketplace details on real products under that
// category (see ProductService.SetMarketplaceDetailsAsync). No BusinessId of its own — like
// CategoryField, tenant isolation comes from always being reached through an already-scoped
// CategoryId, never queried directly.
public class MarketplaceDetailTemplateLabel : BaseEntity
{
    public Guid CategoryId { get; set; }
    public string Section { get; set; } = null!; // STYLE | FEATURES_SPECS | ITEM_DETAILS
    public string Label { get; set; } = null!;
    public string? ValuePlaceholder { get; set; }
    public int SortOrder { get; set; } = 0;

    public Category Category { get; set; } = null!;
}
