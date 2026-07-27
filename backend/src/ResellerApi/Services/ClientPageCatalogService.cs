using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.DTOs.Common;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ClientPageCatalogService : IClientPageCatalogService
{
    // Same thresholds the frontend's isFlashSale/isHighRating predicates already use
    // (clientPage/src/lib/discount.ts, rating.ts) — moved server-side so these can be
    // real DB-level filters+sorts instead of a full-list client fetch.
    private const int FlashSaleMinDiscountPercent = 40;
    private const decimal HighRatingMin = 4m;

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
            var images = await GetCategoryImagesAsync(categories.Select(c => c.Id), ignoreFilters: false);
            return categories.Select(c => new ClientPageCategoryDto(c.Id, c.Name, images.GetValueOrDefault(c.Id))).ToList();
        }

        // Marketplace mode: categories that have at least one ACTIVE product belonging to a
        // business that opted in — the one place allowed to read across tenants, kept as its
        // own explicit path rather than a silent branch (see spec doc §2).
        var categoryIds = await _db.Products
            .IgnoreQueryFilters()
            .Where(p => p.DeletedAt == null && p.Status == "ACTIVE" && p.ShowOnMarketplace &&
                        _db.Businesses.IgnoreQueryFilters().Any(b =>
                            b.Id == p.BusinessId && b.DeletedAt == null && b.ShowOnMarketplace))
            .Select(p => p.CategoryId)
            .Distinct()
            .ToListAsync();

        var marketplaceCategories = await _db.Categories
            .IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null && categoryIds.Contains(c.Id))
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name })
            .ToListAsync();

        // categoryIds already came from marketplace-eligible businesses only, so no extra
        // ShowOnMarketplace check is needed here — a Category belongs to exactly one business.
        var marketplaceImages = await GetCategoryImagesAsync(marketplaceCategories.Select(c => c.Id), ignoreFilters: true);
        return marketplaceCategories
            .Select(c => new ClientPageCategoryDto(c.Id, c.Name, marketplaceImages.GetValueOrDefault(c.Id)))
            .ToList();
    }

    // One representative image per category, taken from its most recently created ACTIVE
    // product (variant image if set, else the product's own image) — purely cosmetic, so a
    // best-effort thumbnail beats requiring every shop owner to curate a dedicated category icon.
    private async Task<Dictionary<Guid, string?>> GetCategoryImagesAsync(IEnumerable<Guid> categoryIds, bool ignoreFilters)
    {
        var idsList = categoryIds.ToList();
        if (idsList.Count == 0) return new Dictionary<Guid, string?>();

        var query = _db.Products.AsQueryable();
        if (ignoreFilters) query = query.IgnoreQueryFilters();

        // ShowOnMarketplace only matters in marketplace mode (ignoreFilters=true) — a shop's own
        // subdomain page (shop mode) shows all its own active products regardless, same as
        // Business.ShowOnMarketplace not affecting that page either.
        var rows = await query
            .Where(p => p.DeletedAt == null && p.Status == "ACTIVE" && idsList.Contains(p.CategoryId) &&
                        (!ignoreFilters || p.ShowOnMarketplace))
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.CategoryId,
                ImageUrl = p.Variants.Where(v => v.DeletedAt == null).Select(v => v.ImageUrl).FirstOrDefault(x => x != null) ?? p.ImageUrl
            })
            .ToListAsync();

        return rows
            .Where(r => r.ImageUrl != null)
            .GroupBy(r => r.CategoryId)
            .ToDictionary(g => g.Key, g => g.First().ImageUrl);
    }

    public async Task<PagedResult<ClientPageProductCardDto>> SearchAsync(
        ClientPageShopContext shopContext, string? q, Guid? categoryId, bool onlyInStock,
        string sort = "default", int page = 1, int pageSize = 60)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        if (shopContext.IsShopMode)
        {
            var results = !string.IsNullOrWhiteSpace(q)
                ? await _products.SearchAsync(q, onlyInStock)
                : await _products.BrowseAsync(categoryId, onlyInStock);

            // Imageless products look broken on the public storefront — never surface them here.
            // IProductService itself stays untouched since the internal staff product list still
            // needs to show every product regardless of photo status.
            results = results.Where(r => !string.IsNullOrWhiteSpace(r.ImageUrl)).ToList();

            var ratings = await GetRatingsAsync(results.Select(r => r.Id).Distinct());

            var cards = results.Select(r =>
            {
                var (avg, count) = ratings.GetValueOrDefault(r.Id);
                return new ClientPageProductCardDto(
                    r.Id, r.VariantId, r.Name, r.ImageUrl, r.UnitCode, r.EffectivePrice,
                    r.VariantValuesJson, r.Stock > 0, shopContext.BusinessId!.Value, shopContext.ShopName!,
                    count > 0 ? avg : null, count, r.MarketPrice
                );
            }).ToList();

            // A single shop's own catalog is small (never "millions of rows"), so — unlike the
            // marketplace branch below — sorting/filtering in memory over the already-fetched
            // (and now capped-at-500, see ProductService.BrowseAsync) list is fine here.
            cards = await ApplyShopModeSortAsync(cards, sort);

            var total = cards.Count;
            var pageItems = cards.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            return new PagedResult<ClientPageProductCardDto>(pageItems, total, page, pageSize);
        }

        return await SearchMarketplaceAsync(q, categoryId, onlyInStock, sort, page, pageSize);
    }

    private async Task<List<ClientPageProductCardDto>> ApplyShopModeSortAsync(List<ClientPageProductCardDto> cards, string sort)
    {
        switch (sort)
        {
            case "discount":
                return cards
                    .Where(c => DiscountPercent(c) >= FlashSaleMinDiscountPercent)
                    .OrderByDescending(DiscountPercent)
                    .ToList();
            case "rating":
                return cards
                    .Where(c => (decimal)(c.AverageRating ?? 0) >= HighRatingMin)
                    .OrderByDescending(c => c.AverageRating ?? 0)
                    .ToList();
            case "popularity":
            {
                // PopularityScore lives on Product, not in ProductSearchResultDto (that DTO is
                // shared with the staff app — deliberately not touched), so it needs a small
                // separate lookup here rather than being carried through from IProductService.
                var ids = cards.Select(c => c.ProductId).Distinct().ToList();
                var scores = await _db.Products.IgnoreQueryFilters()
                    .Where(p => ids.Contains(p.Id))
                    .Select(p => new { p.Id, p.PopularityScore })
                    .ToDictionaryAsync(x => x.Id, x => x.PopularityScore);
                return cards.OrderByDescending(c => scores.GetValueOrDefault(c.ProductId, 0)).ToList();
            }
            default:
                return cards; // already name-ordered by the upstream IProductService query
        }
    }

    private static int DiscountPercent(ClientPageProductCardDto c) =>
        c.MarketPrice is decimal mp && mp > c.Price ? (int)Math.Round((mp - c.Price) / mp * 100) : 0;

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
                dto.CategoryName, shopContext.BusinessId!.Value, shopContext.ShopName!, null,
                dto.Variants.Select(v => new ClientPageVariantDto(
                    v.Id, v.VariantValuesJson, v.PriceOverride ?? dto.SellingPrice,
                    variants.TryGetValue(v.Id, out var inStock) && inStock
                )).ToList(),
                dto.YoutubeUrl,
                dto.MarketplaceDetails.Select(d => new ClientPageMarketplaceDetailDto(d.Section, d.Label, d.Value)).ToList(),
                // Variant photos fold into the same gallery automatically — an owner who's
                // already uploaded per-variant photos shouldn't have to re-upload them again
                // into the separate marketplace gallery just to have them show up publicly.
                dto.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl)
                    .Concat(dto.Variants.Where(v => !string.IsNullOrEmpty(v.ImageUrl)).Select(v => v.ImageUrl!))
                    .Distinct()
                    .ToList(),
                dto.WarrantyDurationValue, dto.WarrantyDurationUnit
            );
        }

        var product = await _db.Products
            .IgnoreQueryFilters()
            .Include(p => p.Category)
            .Include(p => p.Variants.Where(v => v.DeletedAt == null))
            .Include(p => p.MarketplaceDetails.Where(d => d.DeletedAt == null))
            .Include(p => p.Images.Where(i => i.DeletedAt == null))
            .FirstOrDefaultAsync(p => p.Id == productId && p.DeletedAt == null && p.Status == "ACTIVE");
        if (product == null || !product.ShowOnMarketplace) return null; // hidden from marketplace — not found publicly

        var business = await _db.Businesses.IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.Id == product.BusinessId && b.DeletedAt == null && b.ShowOnMarketplace);
        if (business == null) return null; // shop opted out — treat as not found publicly

        var stockByVariant = await BuildVariantAvailabilityAsync(product.Variants.Select(v => v.Id).ToList());

        // Marketplace-mode only: MarketplacePrice, when set, substitutes for the SellingPrice
        // fallback here — the seller's own shop/POS (shop-mode branch above) never sees this.
        var effectiveBasePrice = product.MarketplacePrice ?? product.SellingPrice;

        return new ClientPageProductDetailDto(
            product.Id, product.Name, product.ImageUrl, product.Description, product.UnitCode,
            effectiveBasePrice, product.Category.Name, business.Id, business.Name, business.Subdomain,
            product.Variants.Select(v => new ClientPageVariantDto(
                v.Id, v.VariantValuesJson, v.PriceOverride ?? effectiveBasePrice,
                stockByVariant.TryGetValue(v.Id, out var inStock) && inStock
            )).ToList(),
            product.YoutubeUrl,
            product.MarketplaceDetails
                .OrderBy(d => d.Section).ThenBy(d => d.SortOrder)
                .Select(d => new ClientPageMarketplaceDetailDto(d.Section, d.Label, d.Value)).ToList(),
            // Same variant-photo fold-in as the shop-mode branch above.
            product.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl)
                .Concat(product.Variants.Where(v => !string.IsNullOrEmpty(v.ImageUrl)).Select(v => v.ImageUrl!))
                .Distinct()
                .ToList(),
            product.WarrantyDurationValue, product.WarrantyDurationUnit
        );
    }

    // Same-category products, excluding the one being viewed — reuses SearchAsync's existing
    // shop/marketplace branching wholesale rather than duplicating query logic. Products have no
    // tags/brand field (see Entities/Product.cs), so category is the only taxonomy signal
    // available without a schema change.
    public async Task<List<ClientPageProductCardDto>> GetRelatedProductsAsync(
        ClientPageShopContext shopContext, Guid productId, int take = 8)
    {
        var categoryId = await _db.Products
            .IgnoreQueryFilters()
            .Where(p => p.Id == productId && p.DeletedAt == null)
            .Select(p => (Guid?)p.CategoryId)
            .FirstOrDefaultAsync();
        if (categoryId == null) return new List<ClientPageProductCardDto>();

        var sameCategory = await SearchAsync(shopContext, q: null, categoryId, onlyInStock: false, page: 1, pageSize: take + 1);
        return sameCategory.Items.Where(c => c.ProductId != productId).Take(take).ToList();
    }

    private async Task<PagedResult<ClientPageProductCardDto>> SearchMarketplaceAsync(
        string? q, Guid? categoryId, bool onlyInStock, string sort, int page, int pageSize)
    {
        var query = _db.ProductVariants
            .IgnoreQueryFilters()
            .Include(v => v.Product).ThenInclude(p => p.Category)
            .Where(v => v.DeletedAt == null &&
                        v.Product.DeletedAt == null && v.Product.Status == "ACTIVE" && v.Product.ShowOnMarketplace &&
                        !string.IsNullOrEmpty(v.Product.ImageUrl) &&
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

        // Discount/rating thresholds mirror the frontend's former client-side isFlashSale/
        // isHighRating predicates — now real DB-level filters instead of a full-list fetch.
        // AverageRating/PopularityScore are read directly off Product (precomputed nightly by
        // IPopularityService), so this branch never needs the live ProductReviews join
        // GetRatingsAsync does — that join stays only for the shop-mode branch above.
        // Marketplace-mode only: MarketplacePrice, when set, substitutes for the SellingPrice
        // fallback below — the seller's own shop/POS (shop-mode branch above this method) never
        // sees this, so the "discount" sort/filter must compare against the same effective price
        // the card actually displays, not the raw SellingPrice.
        query = sort switch
        {
            "discount" => query
                .Where(v => v.Product.MarketPrice != null && v.Product.MarketPrice > (v.Product.MarketplacePrice ?? v.Product.SellingPrice) &&
                            (v.Product.MarketPrice.Value - (v.Product.MarketplacePrice ?? v.Product.SellingPrice)) / v.Product.MarketPrice.Value >= 0.40m)
                .OrderByDescending(v => (v.Product.MarketPrice!.Value - (v.Product.MarketplacePrice ?? v.Product.SellingPrice)) / v.Product.MarketPrice!.Value),
            "rating" => query
                .Where(v => v.Product.AverageRating != null && v.Product.AverageRating >= HighRatingMin)
                .OrderByDescending(v => v.Product.AverageRating),
            "popularity" => query.OrderByDescending(v => v.Product.PopularityScore),
            _ => query.OrderBy(v => v.Product.Name).ThenBy(v => v.Sku)
        };

        // onlyInStock is applied post-fetch below (stock isn't a plain column — it's computed
        // from BranchVariantInventory), same pre-existing limitation as before this change: Total
        // and the page boundary are computed pre-stock-filter. Not currently wired to any
        // ClientPage UI control, so left as-is rather than expanding this change's scope.
        var total = await query.CountAsync();
        var variants = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var businesses = await _db.Businesses.IgnoreQueryFilters()
            .Where(b => variants.Select(v => v.Product.BusinessId).Contains(b.Id))
            .ToDictionaryAsync(b => b.Id, b => b.Name);

        var stockByVariant = await BuildVariantAvailabilityAsync(variants.Select(v => v.Id).ToList());

        var cards = variants.Select(v => new ClientPageProductCardDto(
            v.Product.Id, v.Id, v.Product.Name, v.Product.ImageUrl, v.Product.UnitCode,
            v.PriceOverride ?? (v.Product.MarketplacePrice ?? v.Product.SellingPrice), v.VariantValuesJson,
            stockByVariant.TryGetValue(v.Id, out var inStock) && inStock,
            v.Product.BusinessId, businesses.GetValueOrDefault(v.Product.BusinessId, ""),
            v.Product.AverageRating.HasValue ? (double)v.Product.AverageRating.Value : null,
            v.Product.ReviewCount, v.Product.MarketPrice
        )).ToList();

        if (onlyInStock)
            cards = cards.Where(c => c.InStock).ToList();

        return new PagedResult<ClientPageProductCardDto>(cards, total, page, pageSize);
    }

    // Batched per search/browse call rather than N+1 per card — same pattern as
    // BuildVariantAvailabilityAsync below. ProductReview.DeletedAt == null excludes hidden ones.
    private async Task<Dictionary<Guid, (double Average, int Count)>> GetRatingsAsync(IEnumerable<Guid> productIds)
    {
        var idsList = productIds.ToList();
        if (idsList.Count == 0) return new Dictionary<Guid, (double, int)>();

        var rows = await _db.ProductReviews
            .IgnoreQueryFilters()
            .Where(r => r.DeletedAt == null && idsList.Contains(r.ProductId))
            .GroupBy(r => r.ProductId)
            .Select(g => new { ProductId = g.Key, Average = g.Average(r => r.Rating), Count = g.Count() })
            .ToListAsync();

        return rows.ToDictionary(r => r.ProductId, r => (r.Average, r.Count));
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
