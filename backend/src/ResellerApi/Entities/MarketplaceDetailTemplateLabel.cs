using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// A reusable, business-wide library of Style / Features & Specs / Item Details labels — not tied
// to any single product. Grows automatically as sellers save marketplace details on real
// products (see ProductService.SetMarketplaceDetailsAsync), so the label picker gets more useful
// over time without any separate template-management screen.
public class MarketplaceDetailTemplateLabel : BusinessScopedEntity
{
    public string Section { get; set; } = null!; // STYLE | FEATURES_SPECS | ITEM_DETAILS
    public string Label { get; set; } = null!;
}
