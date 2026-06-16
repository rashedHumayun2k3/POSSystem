using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Product : BusinessScopedEntity
{
    public Guid CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string Sku { get; set; } = null!;
    public string? ImageUrl { get; set; }
    public string? Description { get; set; }
    public string? DefectNotes { get; set; }
    public string UnitCode { get; set; } = "pcs";
    public decimal SellingPrice { get; set; }
    public decimal? MarketPrice { get; set; }
    public decimal PackagingCostPerUnit { get; set; } = 0;
    public int LowStockThreshold { get; set; } = 5;
    public string? AttributesJson { get; set; }  // validated against category template
    public string? Note { get; set; }
    public string Status { get; set; } = "ACTIVE"; // ACTIVE, ARCHIVED

    public Category Category { get; set; } = null!;
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
}
