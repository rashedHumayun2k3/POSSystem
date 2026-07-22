using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class ProductVariant : BusinessScopedEntity
{
    public Guid ProductId { get; set; }
    public string VariantValuesJson { get; set; } = "{}"; // e.g. {"Size":"M","Color":"Red"}
    public string Sku { get; set; } = null!;
    public string Barcode { get; set; } = null!;
    public string? ImageUrl { get; set; } // null = falls back to Product.ImageUrl
    public string? Note { get; set; } // free-text details — not folded into VariantValuesJson so it never leaks into the auto-built display label
    public decimal? PriceOverride { get; set; }           // null = use product.SellingPrice
    public bool IsDefault { get; set; } = false;
    public decimal AvgLandedCost { get; set; } = 0;

    public Product Product { get; set; } = null!;
    public ICollection<PriceHistory> PriceHistories { get; set; } = new List<PriceHistory>();
}
