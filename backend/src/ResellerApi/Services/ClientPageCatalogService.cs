using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ClientPageCatalogService : IClientPageCatalogService
{
    private readonly AppDbContext _db;
    private readonly IProductService _products;

    public ClientPageCatalogService(AppDbContext db, IProductService products)
    {
        _db = db;
        _products = products;
    }

    public async Task<List<ClientPageShopDto>> GetPopularShopsAsync()
    {
        return await _db.Businesses
            .IgnoreQueryFilters()
            .Where(b => b.DeletedAt == null && b.ShowOnMarketplace)
            .OrderBy(b => b.Name)
            .Select(b => new ClientPageShopDto(b.Id, b.Name, b.LogoUrl, b.Subdomain))
            .ToListAsync();
    }

    public async Task<List<ClientPageCategoryDto>> GetCategoriesAsync(ClientPageShopContext shopContext)
    {
        if (shopContext.IsShopMode)
        {
            var categories = await _products.ActiveCategoriesAsync();
            return categories.Select(c => new ClientPageCategoryDto(c.Id, c.Name)).ToList();
        }

        // Marketplace mode: categories that have at least one ACTIVE product belonging to a
        // business that opted in — the one place allowed to read across tenants, kept as its
        // own explicit path rather than a silent branch (see spec doc §2).
        var categoryIds = await _db.Products
            .IgnoreQueryFilters()
            .Where(p => p.DeletedAt == null && p.Status == "ACTIVE" &&
                        _db.Businesses.IgnoreQueryFilters().Any(b =>
                            b.Id == p.BusinessId && b.DeletedAt == null && b.ShowOnMarketplace))
            .Select(p => p.CategoryId)
            .Distinct()
            .ToListAsync();

        return await _db.Categories
            .IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null && categoryIds.Contains(c.Id))
            .OrderBy(c => c.Name)
            .Select(c => new ClientPageCategoryDto(c.Id, c.Name))
            .ToListAsync();
    }

    public async Task<List<ClientPageProductCardDto>> SearchAsync(
        ClientPageShopContext shopContext, string? q, Guid? categoryId, bool onlyInStock)
    {
        if (shopContext.IsShopMode)
        {
            var results = !string.IsNullOrWhiteSpace(q)
                ? await _products.SearchAsync(q, onlyInStock)
                : await _products.BrowseAsync(categoryId, onlyInStock);

            return results.Select(r => new ClientPageProductCardDto(
                r.Id, r.VariantId, r.Name, r.ImageUrl, r.UnitCode, r.EffectivePrice,
                r.VariantValuesJson, r.Stock > 0, shopContext.BusinessId!.Value, shopContext.ShopName!
            )).ToList();
        }

        return await SearchMarketplaceAsync(q, categoryId, onlyInStock);
    }

    public async Task<ClientPageProductDetailDto?> GetProductDetailAsync(ClientPageShopContext shopContext, Guid productId)
    {
        if (shopContext.IsShopMode)
        {
            ProductDetailStaffDto dto;
            try
            {
                dto = (ProductDetailStaffDto)await _products.GetAsync(productId, isOwner: false);
            }
            catch (KeyNotFoundException)
            {
                // Correctly tenant-isolated (query filter found nothing) — a mistyped or
                // cross-shop product id is routine public traffic here, unlike the internal
                // staff UI, so it gets a clean 404 rather than propagating as a 500.
                return null;
            }

            var variants = await BuildVariantAvailabilityAsync(dto.Variants.Select(v => v.Id).ToList());

            return new ClientPageProductDetailDto(
                dto.Id, dto.Name, dto.ImageUrl, dto.Description, dto.UnitCode, dto.SellingPrice,
                dto.CategoryName, shopContext.BusinessId!.Value, shopContext.ShopName!,
                dto.Variants.Select(v => new ClientPageVariantDto(
                    v.Id, v.VariantValuesJson, v.PriceOverride ?? dto.SellingPrice,
                    variants.TryGetValue(v.Id, out var inStock) && inStock
                )).ToList()
            );
        }

        var product = await _db.Products
            .IgnoreQueryFilters()
            .Include(p => p.Category)
            .Include(p => p.Variants.Where(v => v.DeletedAt == null))
            .FirstOrDefaultAsync(p => p.Id == productId && p.DeletedAt == null && p.Status == "ACTIVE");
        if (product == null) return null;

        var business = await _db.Businesses.IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.Id == product.BusinessId && b.DeletedAt == null && b.ShowOnMarketplace);
        if (business == null) return null; // shop opted out — treat as not found publicly

        var stockByVariant = await BuildVariantAvailabilityAsync(product.Variants.Select(v => v.Id).ToList());

        return new ClientPageProductDetailDto(
            product.Id, product.Name, product.ImageUrl, product.Description, product.UnitCode,
            product.SellingPrice, product.Category.Name, business.Id, business.Name,
            product.Variants.Select(v => new ClientPageVariantDto(
                v.Id, v.VariantValuesJson, v.PriceOverride ?? product.SellingPrice,
                stockByVariant.TryGetValue(v.Id, out var inStock) && inStock
            )).ToList()
        );
    }

    private async Task<List<ClientPageProductCardDto>> SearchMarketplaceAsync(string? q, Guid? categoryId, bool onlyInStock)
    {
        var query = _db.ProductVariants
            .IgnoreQueryFilters()
            .Include(v => v.Product).ThenInclude(p => p.Category)
            .Where(v => v.DeletedAt == null &&
                        v.Product.DeletedAt == null && v.Product.Status == "ACTIVE" &&
                        _db.Businesses.IgnoreQueryFilters().Any(b =>
                            b.Id == v.Product.BusinessId && b.DeletedAt == null && b.ShowOnMarketplace));

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(v =>
                v.Barcode == term || v.Sku.Contains(term) ||
                v.Product.Name.Contains(term) || v.Product.Sku.Contains(term));
        }

        if (categoryId.HasValue)
            query = query.Where(v => v.Product.CategoryId == categoryId.Value);

        var variants = await query.OrderBy(v => v.Product.Name).ThenBy(v => v.Sku).Take(60).ToListAsync();

        var businesses = await _db.Businesses.IgnoreQueryFilters()
            .Where(b => variants.Select(v => v.Product.BusinessId).Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b.Name);

        var stockByVariant = await BuildVariantAvailabilityAsync(variants.Select(v => v.Id).ToList());

        var cards = variants.Select(v => new ClientPageProductCardDto(
            v.Product.Id, v.Id, v.Product.Name, v.Product.ImageUrl, v.Product.UnitCode,
            v.PriceOverride ?? v.Product.SellingPrice, v.VariantValuesJson,
            stockByVariant.TryGetValue(v.Id, out var inStock) && inStock,
            v.Product.BusinessId, businesses.GetValueOrDefault(v.Product.BusinessId, "")
        ));

        return onlyInStock ? cards.Where(c => c.InStock).ToList() : cards.ToList();
    }

    // Sum of OnHand-Committed-Damaged across every branch (BranchVariantInventory carries no
    // business scoping of its own, so no IgnoreQueryFilters needed here — see entity definition).
    private async Task<Dictionary<Guid, bool>> BuildVariantAvailabilityAsync(List<Guid> variantIds)
    {
        if (variantIds.Count == 0) return new();

        return await _db.BranchVariantInventories
            .Where(i => variantIds.Contains(i.VariantId))
            .GroupBy(i => i.VariantId)
            .Select(g => new { VariantId = g.Key, Available = g.Sum(x => x.OnHand - x.Committed - x.Damaged) })
            .ToDictionaryAsync(x => x.VariantId, x => x.Available > 0);
    }
}
