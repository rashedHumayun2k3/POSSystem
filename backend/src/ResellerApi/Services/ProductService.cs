using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ProductService : IProductService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public ProductService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
    }

    public async Task<List<ProductSummaryDto>> ListAsync(string? status, Guid? categoryId, string? q)
    {
        var query = _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status.ToUpper());
        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId.Value);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(p => p.Name.Contains(q) || p.Sku.Contains(q));

        var products = await query.OrderBy(p => p.Name).ToListAsync();
        return products.Select(p => MapSummary(p)).ToList();
    }

    public async Task<object> GetAsync(Guid id, bool isOwner)
    {
        var p = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Product not found.");

        if (isOwner)
        {
            return new ProductDetailDto(
                p.Id, p.CategoryId, p.Name, p.Sku, p.ImageUrl, p.Description, p.DefectNotes,
                p.UnitCode, p.SellingPrice, p.MarketPrice, p.PackagingCostPerUnit, p.LowStockThreshold,
                p.AttributesJson, p.Note, p.Status, p.Category.Name,
                p.Variants.Where(v => v.DeletedAt == null).Select(MapVariantDto).ToList()
            );
        }

        return new ProductDetailStaffDto(
            p.Id, p.CategoryId, p.Name, p.Sku, p.ImageUrl, p.Description, p.DefectNotes,
            p.UnitCode, p.SellingPrice, p.MarketPrice, p.LowStockThreshold,
            p.AttributesJson, p.Note, p.Status, p.Category.Name,
            p.Variants.Where(v => v.DeletedAt == null).Select(MapVariantStaffDto).ToList()
        );
    }

    public async Task<List<ProductSearchResultDto>> SearchAsync(string q)
    {
        q = q.Trim();
        var variants = await _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .Where(v => v.Product.Status == "ACTIVE" &&
                        (v.Barcode == q ||
                         v.Sku.Contains(q) ||
                         v.Product.Name.Contains(q) ||
                         v.Product.Sku.Contains(q)))
            .OrderBy(v => v.Product.Name).ThenBy(v => v.Sku)
            .Take(30)
            .ToListAsync();

        var inv = await LoadInventoryAsync(variants.Select(v => v.Id));
        return variants.Select(v => MapSearchResult(v, inv, v.AvgLandedCost)).ToList();
    }

    public async Task<List<ProductSearchResultDto>> BrowseAsync(Guid? categoryId)
    {
        var q = _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .Where(v => v.Product.Status == "ACTIVE");

        if (categoryId.HasValue)
            q = q.Where(v => v.Product.CategoryId == categoryId.Value);

        var variants = await q
            .OrderBy(v => v.Product.Name)
            .ThenBy(v => v.Sku)
            .ToListAsync();

        var inv = await LoadInventoryAsync(variants.Select(v => v.Id));
        return variants.Select(v => MapSearchResult(v, inv, v.AvgLandedCost)).ToList();
    }

    public async Task<List<ProductSearchResultDto>> RecentlyPurchasedAsync(int limit)
    {
        var recentVariantIds = await _db.PurchaseItems
            .Where(pi => pi.DeletedAt == null)
            .GroupBy(pi => pi.VariantId)
            .Select(g => new { VariantId = g.Key, LastAt = g.Max(pi => pi.CreatedAt) })
            .OrderByDescending(x => x.LastAt)
            .Take(limit)
            .Select(x => x.VariantId)
            .ToListAsync();

        if (recentVariantIds.Count == 0) return [];

        var variants = await _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .Where(v => recentVariantIds.Contains(v.Id) && v.Product.Status == "ACTIVE")
            .ToListAsync();

        var inv = await LoadInventoryAsync(recentVariantIds);
        return recentVariantIds
            .Select(id => variants.FirstOrDefault(v => v.Id == id))
            .Where(v => v != null)
            .Select(v => MapSearchResult(v!, inv, v!.AvgLandedCost))
            .ToList();
    }

    public async Task<List<ActiveCategoryDto>> ActiveCategoriesAsync()
    {
        var categoryIds = await _db.Products
            .Where(p => p.Status == "ACTIVE")
            .Select(p => p.CategoryId)
            .Distinct()
            .ToListAsync();

        return await _db.Categories
            .Where(c => categoryIds.Contains(c.Id))
            .OrderBy(c => c.Name)
            .Select(c => new ActiveCategoryDto(c.Id, c.Name))
            .ToListAsync();
    }

    public async Task<ProductDetailDto> CreateAsync(CreateProductRequest request, Guid userId)
    {
        var sku = await GenerateSkuAsync();

        var product = new Product
        {
            BusinessId = _business.CurrentBusinessId,
            CategoryId = request.CategoryId,
            Name = request.Name.Trim(),
            Sku = sku,
            ImageUrl = request.ImageUrl,
            Description = request.Description,
            DefectNotes = request.DefectNotes,
            UnitCode = request.UnitCode,
            SellingPrice = request.SellingPrice,
            MarketPrice = request.MarketPrice,
            PackagingCostPerUnit = request.PackagingCostPerUnit,
            LowStockThreshold = request.LowStockThreshold,
            AttributesJson = request.AttributesJson,
            Note = request.Note,
            Status = "ACTIVE"
        };
        _db.Products.Add(product);
        await _db.SaveChangesAsync(); // get product Id

        // Generate variants
        var combinations = request.VariantCombinations ?? new List<Dictionary<string, string>> { new() };
        for (int i = 0; i < combinations.Count; i++)
        {
            var combo = combinations[i];
            var variantJson = System.Text.Json.JsonSerializer.Serialize(combo);
            var barcode = await GenerateBarcodeAsync();
            var variantSku = $"{sku}-{(i + 1):D2}";
            var variant = new ProductVariant
            {
                ProductId = product.Id,
                VariantValuesJson = variantJson,
                Sku = variantSku,
                Barcode = barcode,
                IsDefault = i == 0
            };
            _db.ProductVariants.Add(variant);
        }
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Product", product.Id);

        return (ProductDetailDto)(await GetAsync(product.Id, true));
    }

    public async Task<ProductDetailDto> UpdateAsync(Guid id, UpdateProductRequest request, Guid userId)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Product not found.");

        // Optimistic concurrency check
        if (!product.RowVer.SequenceEqual(request.RowVer))
            throw new DbUpdateConcurrencyException();

        product.CategoryId = request.CategoryId;
        product.Name = request.Name.Trim();
        product.ImageUrl = request.ImageUrl;
        product.Description = request.Description;
        product.DefectNotes = request.DefectNotes;
        product.UnitCode = request.UnitCode;
        product.SellingPrice = request.SellingPrice;
        product.MarketPrice = request.MarketPrice;
        product.PackagingCostPerUnit = request.PackagingCostPerUnit;
        product.LowStockThreshold = request.LowStockThreshold;
        product.AttributesJson = request.AttributesJson;
        product.Note = request.Note;
        product.Status = request.Status;

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Product", product.Id);
        return (ProductDetailDto)(await GetAsync(product.Id, true));
    }

    public async Task ArchiveAsync(Guid id, Guid userId)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Product not found.");

        product.Status = "ARCHIVED";
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Product", product.Id);
    }

    public async Task<VariantDto> AddVariantAsync(Guid productId, CreateVariantRequest request, Guid userId)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId)
            ?? throw new KeyNotFoundException("Product not found.");

        var variantCount = await _db.ProductVariants.CountAsync(v => v.ProductId == productId);
        var sku = $"{product.Sku}-{(variantCount + 1):D2}";
        var barcode = request.Barcode ?? await GenerateBarcodeAsync();

        var variant = new ProductVariant
        {
            ProductId = productId,
            VariantValuesJson = request.VariantValuesJson,
            Sku = sku,
            Barcode = barcode,
            PriceOverride = request.PriceOverride,
            IsDefault = request.IsDefault
        };

        if (request.IsDefault)
        {
            var currentDefault = await _db.ProductVariants.FirstOrDefaultAsync(v => v.ProductId == productId && v.IsDefault);
            if (currentDefault != null) currentDefault.IsDefault = false;
        }

        _db.ProductVariants.Add(variant);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "ProductVariant", variant.Id);
        return MapVariantDto(variant);
    }

    public async Task<VariantDto> UpdateVariantAsync(Guid productId, Guid variantId, UpdateVariantRequest request, Guid userId)
    {
        var variant = await _db.ProductVariants.FirstOrDefaultAsync(v => v.Id == variantId && v.ProductId == productId)
            ?? throw new KeyNotFoundException("Variant not found.");

        if (!variant.RowVer.SequenceEqual(request.RowVer))
            throw new DbUpdateConcurrencyException();

        if (request.IsDefault && !variant.IsDefault)
        {
            var currentDefault = await _db.ProductVariants.FirstOrDefaultAsync(v => v.ProductId == productId && v.IsDefault);
            if (currentDefault != null) currentDefault.IsDefault = false;
        }

        variant.PriceOverride = request.PriceOverride;
        variant.IsDefault = request.IsDefault;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "ProductVariant", variant.Id);
        return MapVariantDto(variant);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<string> GenerateSkuAsync()
    {
        var count = await _db.Products.CountAsync() + 1;
        return $"P-{count:D4}";
    }

    private async Task<string> GenerateBarcodeAsync()
    {
        // Simple EAN-8 style: business prefix + sequential number
        var count = await _db.ProductVariants.CountAsync() + 1;
        var raw = $"880{count:D5}";
        return raw + ComputeLuhn(raw);
    }

    private static char ComputeLuhn(string digits)
    {
        int sum = 0;
        for (int i = 0; i < digits.Length; i++)
            sum += (digits[i] - '0') * (i % 2 == 0 ? 3 : 1);
        int check = (10 - (sum % 10)) % 10;
        return (char)('0' + check);
    }

    private static VariantDto MapVariantDto(ProductVariant v) => new(
        v.Id, v.VariantValuesJson, v.Sku, v.Barcode, v.PriceOverride, v.IsDefault, v.AvgLandedCost
    );

    private static VariantStaffDto MapVariantStaffDto(ProductVariant v) => new(
        v.Id, v.VariantValuesJson, v.Sku, v.Barcode, v.PriceOverride, v.IsDefault
    );

    private async Task<Dictionary<Guid, VariantInventory>> LoadInventoryAsync(IEnumerable<Guid> variantIds)
    {
        var ids = variantIds.ToList();
        return await _db.VariantInventories
            .Where(i => ids.Contains(i.VariantId))
            .ToDictionaryAsync(i => i.VariantId);
    }

    private static ProductSearchResultDto MapSearchResult(
        ProductVariant v,
        Dictionary<Guid, VariantInventory> inv,
        decimal avgLandedCost) => new(
        v.Product.Id,
        v.Id,
        v.Product.Name,
        v.Sku,
        v.Barcode,
        v.PriceOverride ?? v.Product.SellingPrice,
        v.Product.ImageUrl,
        v.Product.UnitCode ?? "",
        v.VariantValuesJson,
        inv.TryGetValue(v.Id, out var i) ? i.OnHand : 0m,
        avgLandedCost
    );

    private static ProductSummaryDto MapSummary(Product p) => new(
        p.Id, p.Name, p.Sku, p.ImageUrl, p.UnitCode, p.SellingPrice, p.MarketPrice,
        p.PackagingCostPerUnit, p.Status, p.Category?.Name ?? "", p.Variants.Count,
        0   // total stock from inventory Phase 3
    );
}
