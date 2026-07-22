using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ProductService : IProductService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;
    private readonly IPurchaseTripService _purchaseTrips;

    public ProductService(AppDbContext db, IBusinessContext business, IActivityLogService log, IPurchaseTripService purchaseTrips)
    {
        _db = db;
        _business = business;
        _log = log;
        _purchaseTrips = purchaseTrips;
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

        var variantIds = products.SelectMany(p => p.Variants).Select(v => v.Id);
        var inv = await LoadInventoryAsync(variantIds);

        return products.Select(p => MapSummary(p, inv)).ToList();
    }

    // Backs the "My Added Products" tab on the catalog-templates page — every product under a
    // curated category (SuggestedCategoryId set), regardless of whether it was added via the
    // suggestion picker or created manually afterward under that same category.
    public async Task<List<ProductSummaryDto>> ListFromSuggestedCategoriesAsync()
    {
        var products = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Where(p => p.Category.SuggestedCategoryId != null)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        var variantIds = products.SelectMany(p => p.Variants).Select(v => v.Id);
        var inv = await LoadInventoryAsync(variantIds);

        return products.Select(p => MapSummary(p, inv)).ToList();
    }

    public async Task<object> GetAsync(Guid id, bool isOwner)
    {
        var p = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.MarketplaceDetails)
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Product not found.");

        var details = p.MarketplaceDetails
            .OrderBy(d => d.Section).ThenBy(d => d.SortOrder)
            .Select(d => new ProductMarketplaceDetailDto(d.Id, d.Section, d.Label, d.Value, d.SortOrder))
            .ToList();
        var images = p.Images
            .OrderBy(i => i.SortOrder)
            .Select(i => new ProductImageDto(i.Id, i.ImageUrl, i.SortOrder))
            .ToList();

        if (isOwner)
        {
            var inv = await LoadInventoryAsync(p.Variants.Select(v => v.Id));
            return new ProductDetailDto(
                p.Id, p.CategoryId, p.Name, p.Sku, p.ImageUrl, p.Description, p.DefectNotes,
                p.UnitCode, p.SellingPrice, p.MarketPrice, p.MarketplacePrice, p.PackagingCostPerUnit, p.LowStockThreshold,
                p.AttributesJson, p.Note, p.Status, p.Category.Name,
                p.Variants.Where(v => v.DeletedAt == null).Select(v => MapVariantDto(v, inv)).ToList(),
                p.RowVer, p.ShowOnMarketplace, p.YoutubeUrl, details, images,
                p.WarrantyDurationValue, p.WarrantyDurationUnit
            );
        }

        return new ProductDetailStaffDto(
            p.Id, p.CategoryId, p.Name, p.Sku, p.ImageUrl, p.Description, p.DefectNotes,
            p.UnitCode, p.SellingPrice, p.MarketPrice, p.MarketplacePrice, p.LowStockThreshold,
            p.AttributesJson, p.Note, p.Status, p.Category.Name,
            p.Variants.Where(v => v.DeletedAt == null).Select(MapVariantStaffDto).ToList(),
            p.YoutubeUrl, details, images,
            p.WarrantyDurationValue, p.WarrantyDurationUnit
        );
    }

    private static readonly string[] AllowedMarketplaceDetailSections = { "STYLE", "FEATURES_SPECS", "ITEM_DETAILS" };

    public async Task SetMarketplaceDetailsAsync(Guid productId, UpdateMarketplaceDetailsRequest request, Guid userId)
    {
        foreach (var d in request.Details)
        {
            if (!AllowedMarketplaceDetailSections.Contains(d.Section))
                throw new ArgumentException($"Invalid section: {d.Section}");
            if (string.IsNullOrWhiteSpace(d.Label) || string.IsNullOrWhiteSpace(d.Value))
                throw new ArgumentException("Label and value are required for every detail row.");
        }
        if (!string.IsNullOrWhiteSpace(request.YoutubeUrl) &&
            !request.YoutubeUrl.Contains("youtube.com") && !request.YoutubeUrl.Contains("youtu.be"))
            throw new ArgumentException("Please provide a valid YouTube URL.");
        if (request.MarketplacePrice is <= 0)
            throw new ArgumentException("Marketplace price must be greater than zero.");

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId)
            ?? throw new KeyNotFoundException("Product not found.");

        product.YoutubeUrl = string.IsNullOrWhiteSpace(request.YoutubeUrl) ? null : request.YoutubeUrl.Trim();
        product.MarketplacePrice = request.MarketplacePrice;

        // Soft-delete the old rows and insert fresh ones rather than mutating in place — simplest
        // correct way to apply a full-replace edit to a small freeform list while still honoring
        // the project's soft-delete-only rule.
        var existing = await _db.ProductMarketplaceDetails
            .Where(d => d.ProductId == productId)
            .ToListAsync();
        foreach (var d in existing) d.DeletedAt = DateTime.UtcNow;

        foreach (var d in request.Details)
        {
            _db.ProductMarketplaceDetails.Add(new ProductMarketplaceDetail
            {
                BusinessId = _business.CurrentBusinessId,
                ProductId = productId,
                Section = d.Section,
                Label = d.Label.Trim(),
                Value = d.Value.Trim(),
                SortOrder = d.SortOrder
            });
        }

        await AddNewTemplateLabelsAsync(product.CategoryId, request.Details.Select(d => (d.Section, d.Label.Trim())));

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "ProductMarketplaceDetails", productId);
    }

    // Grows the reusable label picker organically — any label a seller actually uses on a product
    // in this category that isn't already in the category's template library gets added to it, no
    // separate management screen needed. Values are deliberately never captured here (they're
    // product-specific), only labels.
    private async Task AddNewTemplateLabelsAsync(Guid categoryId, IEnumerable<(string Section, string Label)> used)
    {
        var distinctUsed = used.Where(x => x.Label.Length > 0).Distinct().ToList();
        if (distinctUsed.Count == 0) return;

        var existing = await _db.MarketplaceDetailTemplateLabels
            .Where(t => t.CategoryId == categoryId)
            .Select(t => new { t.Section, t.Label, t.SortOrder })
            .ToListAsync();
        var existingSet = existing.Select(e => (e.Section, e.Label)).ToHashSet();
        var nextSortOrder = existing.Count == 0 ? 0 : existing.Max(e => e.SortOrder) + 1;

        foreach (var (section, label) in distinctUsed)
        {
            if (existingSet.Contains((section, label))) continue;
            _db.MarketplaceDetailTemplateLabels.Add(new MarketplaceDetailTemplateLabel
            {
                CategoryId = categoryId,
                Section = section,
                Label = label,
                SortOrder = nextSortOrder++
            });
        }
    }

    public async Task<List<MarketplaceDetailTemplateLabelDto>> GetMarketplaceDetailTemplatesAsync(Guid categoryId)
    {
        var categoryExists = await _db.Categories.AnyAsync(c => c.Id == categoryId);
        if (!categoryExists) throw new KeyNotFoundException("Category not found.");

        return await _db.MarketplaceDetailTemplateLabels
            .AsNoTracking()
            .Where(t => t.CategoryId == categoryId)
            .OrderBy(t => t.Section).ThenBy(t => t.SortOrder)
            .Select(t => new MarketplaceDetailTemplateLabelDto(t.Section, t.Label, t.ValuePlaceholder, t.SortOrder))
            .ToListAsync();
    }

    private const int MaxProductImages = 10;

    public async Task<ProductImageDto> AddImageAsync(Guid productId, AddProductImageRequest request, Guid userId)
    {
        var productExists = await _db.Products.AnyAsync(p => p.Id == productId);
        if (!productExists) throw new KeyNotFoundException("Product not found.");

        var count = await _db.ProductImages.CountAsync(i => i.ProductId == productId);
        if (count >= MaxProductImages)
            throw new ArgumentException($"A product can have at most {MaxProductImages} gallery photos.");

        var image = new ProductImage
        {
            BusinessId = _business.CurrentBusinessId,
            ProductId = productId,
            ImageUrl = request.ImageUrl,
            SortOrder = count
        };
        _db.ProductImages.Add(image);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "ProductImage", image.Id);

        return new ProductImageDto(image.Id, image.ImageUrl, image.SortOrder);
    }

    public async Task RemoveImageAsync(Guid productId, Guid imageId, Guid userId)
    {
        var image = await _db.ProductImages.FirstOrDefaultAsync(i => i.Id == imageId && i.ProductId == productId)
            ?? throw new KeyNotFoundException("Image not found.");

        image.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "DELETE", "ProductImage", imageId);
    }

    public async Task ReorderImagesAsync(Guid productId, ReorderProductImagesRequest request, Guid userId)
    {
        var images = await _db.ProductImages.Where(i => i.ProductId == productId).ToListAsync();
        if (request.ImageIdsInOrder.Count != images.Count || images.Any(i => !request.ImageIdsInOrder.Contains(i.Id)))
            throw new ArgumentException("The image list doesn't match this product's current gallery.");

        for (int i = 0; i < request.ImageIdsInOrder.Count; i++)
        {
            var image = images.First(x => x.Id == request.ImageIdsInOrder[i]);
            image.SortOrder = i;
        }
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "ProductImageOrder", productId);
    }

    public async Task<List<ProductSearchResultDto>> SearchAsync(string q, bool onlyInStock = false)
    {
        q = q.Trim();
        var query = _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .Where(v => v.Product.Status == "ACTIVE" &&
                        (v.Barcode == q ||
                         v.Sku.Contains(q) ||
                         v.Product.Name.Contains(q) ||
                         v.Product.Sku.Contains(q)));

        if (onlyInStock)
            query = query.Where(HasStockInCurrentScope());

        var variants = await query
            .OrderBy(v => v.Product.Name).ThenBy(v => v.Sku)
            .Take(30)
            .ToListAsync();

        var inv = await LoadInventoryAsync(variants.Select(v => v.Id));
        return variants.Select(v => MapSearchResult(v, inv, v.AvgLandedCost)).ToList();
    }

    public async Task<ProductSearchResultDto?> GetByBarcodeAsync(string barcode)
    {
        var variant = await _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Barcode == barcode && v.Product.Status == "ACTIVE");
        if (variant == null) return null;
        var inv = await LoadInventoryAsync(new[] { variant.Id });
        return MapSearchResult(variant, inv, variant.AvgLandedCost);
    }

    public async Task<List<ProductSearchResultDto>> BrowseAsync(Guid? categoryId, bool onlyInStock = false)
    {
        var q = _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .Where(v => v.Product.Status == "ACTIVE");

        if (categoryId.HasValue)
            q = q.Where(v => v.Product.CategoryId == categoryId.Value);

        if (onlyInStock)
            q = q.Where(HasStockInCurrentScope());

        var variants = await q
            .OrderBy(v => v.Product.Name)
            .ThenBy(v => v.Sku)
            // Defensive ceiling — this previously had no cap at all, meaning a business with a
            // large catalog would return its entire product_variants table in one query/payload.
            // 500 is generous enough that no real reseller catalog hits it in practice.
            .Take(500)
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
        // Fail fast, before anything is persisted, rather than leaving a product created without
        // its requested opening stock if branch resolution turns out to be ambiguous.
        if (request.InitialStock is > 0 && !request.BranchId.HasValue)
        {
            var activeBranchCount = await _db.Branches.CountAsync(b => b.IsActive);
            if (activeBranchCount != 1)
                throw new ArgumentException("This business has multiple branches — please select which branch the initial stock belongs to.");
        }

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
            Status = "ACTIVE",
            WarrantyDurationValue = request.WarrantyDurationValue,
            WarrantyDurationUnit = request.WarrantyDurationUnit
        };
        _db.Products.Add(product);
        await _db.SaveChangesAsync(); // get product Id

        // Generate variants
        var combinations = request.VariantCombinations ?? new List<Dictionary<string, string>> { new() };
        ProductVariant? soleVariant = null;
        for (int i = 0; i < combinations.Count; i++)
        {
            var combo = combinations[i];
            var variantJson = System.Text.Json.JsonSerializer.Serialize(combo);
            var barcode = await GenerateBarcodeAsync();
            var variantSku = $"{sku}-{(i + 1):D2}";
            var variant = new ProductVariant
            {
                BusinessId = _business.CurrentBusinessId,
                ProductId = product.Id,
                VariantValuesJson = variantJson,
                Sku = variantSku,
                Barcode = barcode,
                IsDefault = i == 0
            };
            _db.ProductVariants.Add(variant);
            if (combinations.Count == 1) soleVariant = variant;
        }
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Product", product.Id);

        // "I already own some of these" — only meaningful for a single-variant product; a
        // multi-variant product (e.g. Size/Color combinations) needs per-variant quantities,
        // which this simple pair of fields can't express — those go through the normal Stock
        // Adjustment flow instead, same as today.
        if (soleVariant != null && request.InitialStock is > 0)
        {
            await RecordOpeningStockAsync(soleVariant.Id, request.InitialStock.Value, request.CostPrice ?? 0, request.BranchId, userId);
        }

        return (ProductDetailDto)(await GetAsync(product.Id, true));
    }

    // Silently drives the real Purchase Trip pipeline (source type OPENING_BALANCE, already
    // whitelisted — see PurchaseTripService) so stock entered here goes through the exact same
    // landed-cost/weighted-average machinery as a real supplier purchase, rather than writing
    // AvgLandedCost directly. That keeps every unit of stock in the system traceable to a real
    // trip, so future real purchases don't get averaged against a fabricated number.
    private async Task RecordOpeningStockAsync(Guid variantId, decimal qty, decimal costPerUnit, Guid? branchId, Guid userId)
    {
        var supplierId = await GetOrCreateOpeningStockSupplierAsync();

        var trip = await _purchaseTrips.CreateAsync(
            new CreatePurchaseTripRequest("OPENING_BALANCE", "Opening stock recorded at product creation", branchId), userId);

        var item = await _purchaseTrips.AddItemAsync(trip.Id,
            new AddPurchaseItemRequest(variantId, qty, costPerUnit * qty, supplierId, null, 0, 0, null), userId);

        await _purchaseTrips.CreateReceiveSessionAsync(trip.Id,
            new CreateReceiveSessionRequest(DateTime.UtcNow, "WALK_IN", null, "Opening stock",
                new List<SessionItemInput> { new(item.Id, qty, 0, "{}") }),
            userId, isOwner: true);
    }

    private async Task<Guid> GetOrCreateOpeningStockSupplierAsync()
    {
        const string name = "Opening Stock";
        var existing = await _db.Suppliers
            .FirstOrDefaultAsync(s => s.BusinessId == _business.CurrentBusinessId && s.Name == name);
        if (existing != null) return existing.Id;

        var supplier = new Supplier
        {
            BusinessId = _business.CurrentBusinessId,
            Name = name,
            Notes = "SYSTEM_RESERVED — auto-created to record stock owned before this product was added to the app."
        };
        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync();
        return supplier.Id;
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
        product.WarrantyDurationValue = request.WarrantyDurationValue;
        product.WarrantyDurationUnit = request.WarrantyDurationUnit;

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Product", product.Id);
        return (ProductDetailDto)(await GetAsync(product.Id, true));
    }

    public async Task<List<VariantLabelData>> GetVariantLabelsAsync(Guid productId, Guid? variantId)
    {
        var product = await _db.Products
            .AsNoTracking()
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == productId)
            ?? throw new KeyNotFoundException("Product not found.");

        var variants = product.Variants
            .Where(v => v.DeletedAt == null && (variantId == null || v.Id == variantId))
            .ToList();

        return variants.Select(v =>
        {
            var vals = System.Text.Json.JsonSerializer
                .Deserialize<Dictionary<string, string>>(v.VariantValuesJson ?? "{}") ?? new();
            var label = string.Join(" / ", vals.Values.Where(x => !string.IsNullOrWhiteSpace(x)));
            var price = v.PriceOverride ?? product.SellingPrice;
            return new VariantLabelData(product.Name, label, v.Barcode, v.Sku, price);
        }).ToList();
    }

    public async Task ArchiveAsync(Guid id, Guid userId)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Product not found.");

        product.Status = "ARCHIVED";
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Product", product.Id);
    }

    public async Task<bool> SetShowOnMarketplaceAsync(Guid id, bool show, Guid userId)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Product not found.");

        product.ShowOnMarketplace = show;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Product", product.Id);
        return product.ShowOnMarketplace;
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
            BusinessId = _business.CurrentBusinessId,
            ProductId = productId,
            VariantValuesJson = request.VariantValuesJson,
            Sku = sku,
            Barcode = barcode,
            ImageUrl = request.ImageUrl,
            Note = request.Note,
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
        // Brand new variant — no purchase trip has ever touched it, so stock is always 0.
        return MapVariantDto(variant, new Dictionary<Guid, decimal>());
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

        variant.ImageUrl = request.ImageUrl;
        variant.Note = request.Note;
        variant.PriceOverride = request.PriceOverride;
        variant.IsDefault = request.IsDefault;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "ProductVariant", variant.Id);
        var inv = await LoadInventoryAsync(new[] { variant.Id });
        return MapVariantDto(variant, inv);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<string> GenerateSkuAsync()
    {
        // IgnoreQueryFilters so an archived (soft-deleted) product's number is never reused —
        // its row still occupies the (BusinessId, Sku) unique index. Scoped to this business
        // only: Sku uniqueness is per-business, not global (two tenants can both have "P-0001").
        var count = await _db.Products.IgnoreQueryFilters()
            .CountAsync(p => p.BusinessId == _business.CurrentBusinessId) + 1;
        return $"P-{count:D4}";
    }

    private async Task<string> GenerateBarcodeAsync()
    {
        // Simple EAN-8 style: business prefix + sequential number. Barcodes are globally
        // unique (no BusinessId on ProductVariant), so count across all businesses — but still
        // IgnoreQueryFilters so a soft-deleted variant's number is never reused.
        var count = await _db.ProductVariants.IgnoreQueryFilters().CountAsync() + 1;
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

    private static VariantDto MapVariantDto(ProductVariant v, Dictionary<Guid, decimal> inv) => new(
        v.Id, v.VariantValuesJson, v.Sku, v.Barcode, v.ImageUrl, v.Note, v.PriceOverride, v.IsDefault, v.AvgLandedCost,
        inv.TryGetValue(v.Id, out var onHand) ? onHand : 0m, v.RowVer
    );

    private static VariantStaffDto MapVariantStaffDto(ProductVariant v) => new(
        v.Id, v.VariantValuesJson, v.Sku, v.Barcode, v.ImageUrl, v.Note, v.PriceOverride, v.IsDefault
    );

    // POS search opt-in filter (onlyInStock): true when the variant has any branch_variant_
    // inventories row, in the current branch scope, with real sellable stock (OnHand minus
    // Committed/Damaged) — not just OnHand > 0, so already-reserved units don't show as
    // available. Same branch-scoping convention as LoadInventoryAsync (null CurrentBranchId =
    // OWNER/MANAGER "All Branches", checks across every branch instead of one).
    private Expression<Func<ProductVariant, bool>> HasStockInCurrentScope() => v =>
        _db.BranchVariantInventories.Any(i =>
            i.VariantId == v.Id &&
            (_db.CurrentBranchId == null || i.BranchId == _db.CurrentBranchId) &&
            i.OnHand - i.Committed - i.Damaged > 0);

    // Reads from branch_variant_inventories, not the old single-pool variant_inventories
    // (frozen/stale since stock mutations moved to the branch-aware table). Sums across
    // branches when CurrentBranchId is null (OWNER/MANAGER "All Branches" view), otherwise
    // scoped to the active branch — same convention used in ReportService.
    private async Task<Dictionary<Guid, decimal>> LoadInventoryAsync(IEnumerable<Guid> variantIds)
    {
        var ids = variantIds.ToList();
        return await _db.BranchVariantInventories
            .Where(i => ids.Contains(i.VariantId) && (_db.CurrentBranchId == null || i.BranchId == _db.CurrentBranchId))
            .GroupBy(i => i.VariantId)
            .Select(g => new { VariantId = g.Key, OnHand = g.Sum(x => x.OnHand) })
            .ToDictionaryAsync(x => x.VariantId, x => x.OnHand);
    }

    private static ProductSearchResultDto MapSearchResult(
        ProductVariant v,
        Dictionary<Guid, decimal> inv,
        decimal avgLandedCost) => new(
        v.Product.Id,
        v.Id,
        v.Product.Name,
        v.Sku,
        v.Barcode,
        v.PriceOverride ?? v.Product.SellingPrice,
        v.ImageUrl ?? v.Product.ImageUrl,
        v.Product.UnitCode ?? "",
        v.VariantValuesJson,
        inv.TryGetValue(v.Id, out var onHand) ? onHand : 0m,
        avgLandedCost,
        v.Product.MarketPrice
    );

    private static ProductSummaryDto MapSummary(Product p, Dictionary<Guid, decimal> inv) => new(
        p.Id, p.Name, p.Sku, p.ImageUrl, p.UnitCode, p.SellingPrice, p.MarketPrice, p.MarketplacePrice,
        p.PackagingCostPerUnit, p.Status, p.Category?.Name ?? "", p.Variants.Count,
        (int)p.Variants.Sum(v => inv.TryGetValue(v.Id, out var onHand) ? onHand : 0m),
        p.LowStockThreshold
    );
}
