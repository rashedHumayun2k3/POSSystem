using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Product : BusinessScopedEntity
{
    public Guid CategoryId { get; set; }
    public Guid? SuggestedProductId { get; set; }
    public string Name { get; set; } = null!;
    public string Sku { get; set; } = null!;
    public string? ImageUrl { get; set; }
    public string ImageSource { get; set; } = "INDIVIDUAL";
    public string? Description { get; set; }
    public string? DefectNotes { get; set; }
    public string UnitCode { get; set; } = "pcs";
    public decimal SellingPrice { get; set; }
    public decimal? MarketPrice { get; set; }

    // Marketplace-channel-only price override — null means "inherit SellingPrice" (same tier
    // MarketPrice already sits at). Only ClientPageCatalogService's marketplace-mode paths read
    // this; the seller's own shop/POS always uses SellingPrice directly, untouched. Edited only
    // via the Marketplace tab's dedicated endpoint (SetMarketplaceDetailsAsync), not the general
    // product-edit form.
    public decimal? MarketplacePrice { get; set; }
    public decimal PackagingCostPerUnit { get; set; } = 0;

    // Optional single wholesale (পাইকারি) tier — additive, not exclusive: SellingPrice always
    // still applies below WholesaleMinQty. Both null = wholesale off for this product. Never
    // both-one-null: enforced in ProductService, not the database.
    public decimal? WholesaleMinQty { get; set; }
    public decimal? WholesaleUnitPrice { get; set; }
    public string? WholesaleNote { get; set; } // short owner note shown with the wholesale price quote
    public int LowStockThreshold { get; set; } = 5;
    public string? AttributesJson { get; set; }  // validated against category template
    public string? Note { get; set; }
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, ARCHIVED

    // Per-product override for the ClientPage marketplace listing — defaults to true so this is
    // purely additive: every existing product stays visible exactly as it is today (gated only
    // by Business.ShowOnMarketplace + Status=ACTIVE) unless an owner explicitly hides it.
    public bool ShowOnMarketplace { get; set; } = true;

    // Optional marketplace-only extras (Style / Features & Specs / Item Details tables + a demo
    // video) — purely additive product presentation data, not part of the internal POS/catalog
    // model, so it lives separately rather than folding into AttributesJson (which drives variant
    // generation and is a different concern).
    public string? YoutubeUrl { get; set; }

    // Purely descriptive — no automated claim/expiry tracking. WarrantyDurationUnit e.g.
    // DAYS | MONTHS | YEARS.
    public int? WarrantyDurationValue { get; set; }
    public string? WarrantyDurationUnit { get; set; }

    // Precomputed nightly by IPopularityService.RecomputeAsync (Hangfire, see Program.cs) —
    // never written live per-request. PopularityScore drives the "Popular" homepage section;
    // AverageRating/ReviewCount cache the same aggregate ClientPageCatalogService.GetRatingsAsync
    // used to compute live, so marketplace listing/sort queries can read a plain column instead
    // of joining product_reviews on every request. Individual product-detail review displays are
    // unaffected — they still read product_reviews directly.
    public decimal PopularityScore { get; set; } = 0;
    public decimal? AverageRating { get; set; }
    public int ReviewCount { get; set; } = 0;

    public Category Category { get; set; } = null!;
    public SuggestedProduct? SuggestedProduct { get; set; }
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
    public ICollection<ProductMarketplaceDetail> MarketplaceDetails { get; set; } = new List<ProductMarketplaceDetail>();
    // Extra marketplace gallery photos beyond the single ImageUrl above — Amazon-style thumbnail
    // rail on the public product page. ImageUrl stays the "primary" photo used everywhere else
    // (product lists, cards, POS) so nothing about the existing single-image model changes.
    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
}
