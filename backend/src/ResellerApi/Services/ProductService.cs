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
    private readonly IPriceSlotService _priceSlots;

    public ProductService(AppDbContext db, IBusinessContext business, IActivityLogService log, IPurchaseTripService purchaseTrips, IPriceSlotService priceSlots)
    {
        _db = db;
        _business = business;
        _log = log;
        _purchaseTrips = purchaseTrips;
        _priceSlots = priceSlots;
    }

    // Gives a variant real Activation History from day one instead of a blind spot before its
    // first manually-created offer. Only called for a variant that actually "owns" a starting
    // price value — the default variant with no override (which resolves to Product.SellingPrice)
    // or any variant with an explicit PriceOverride. A non-default variant with no override
    // inherits Product.SellingPrice dynamically (see PriceSlotService.ApplyPriceToVariant); giving
    // it a slot here would pin it to a point-in-time copy and break that inheritance the moment
    // SellingPrice changes later — so that case is deliberately skipped by every call site below.
    // No-op below zero: Catalog Templates' Quick Add leaves SellingPrice genuinely optional
    // (defaults to 0 when left blank) — CreateSlotAsync rejects NewPrice <= 0, and there's nothing
    // meaningful to log yet anyway when no price was ever set.
    private Task CreateOriginalPriceSlotAsync(Guid variantId, decimal price, Guid userId) =>
        price > 0
            ? _priceSlots.CreateSlotAsync(variantId, new CreateSlotRequest("Original Price", price, null), userId)
            : Task.CompletedTask;

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
        var orderStats = await LoadOrderStatsAsync(products.Select(p => p.Id));

        return products.Select(p => MapSummary(p, inv, orderStats)).ToList();
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
        var orderStats = await LoadOrderStatsAsync(products.Select(p => p.Id));

        return products.Select(p => MapSummary(p, inv, orderStats)).ToList();
    }

    public async Task<object> GetAsync(Guid id, bool isOwner)
    {
        // Reconcile scheduled Offers before reading — a "check on read" instead of a background
        // job (see PriceSlotService.EnsureScheduledStateAsync), so this needs to run and commit
        // BEFORE the no-tracking read below, otherwise a just-activated slot's price wouldn't show
        // up in this same request.
        var variantIds = await _db.ProductVariants
            .Where(v => v.ProductId == id && v.DeletedAt == null)
            .Select(v => v.Id)
            .ToListAsync();
        foreach (var variantId in variantIds)
            await _priceSlots.EnsureScheduledStateAsync(variantId);

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
                p.Id, p.CategoryId, p.Name, p.Sku, p.ImageUrl, p.ImageSource, p.SuggestedProductId, p.Description, p.DefectNotes,
                p.UnitCode, p.SellingPrice, p.MarketPrice, p.MarketplacePrice, p.PackagingCostPerUnit, p.LowStockThreshold,
                p.AttributesJson, p.Note, p.Status, p.Category.Name,
                p.Variants.Where(v => v.DeletedAt == null).Select(v => MapVariantDto(v, inv)).ToList(),
                p.RowVer, p.ShowOnMarketplace, p.YoutubeUrl, details, images,
                p.WarrantyDurationValue, p.WarrantyDurationUnit,
                p.AverageRating, p.ReviewCount,
                p.WholesaleMinQty, p.WholesaleUnitPrice, p.WholesaleNote
            );
        }

        return new ProductDetailStaffDto(
            p.Id, p.CategoryId, p.Name, p.Sku, p.ImageUrl, p.ImageSource, p.SuggestedProductId, p.Description, p.DefectNotes,
            p.UnitCode, p.SellingPrice, p.MarketPrice, p.MarketplacePrice, p.LowStockThreshold,
            p.AttributesJson, p.Note, p.Status, p.Category.Name,
            p.Variants.Where(v => v.DeletedAt == null).Select(MapVariantStaffDto).ToList(),
            p.YoutubeUrl, details, images,
            p.WarrantyDurationValue, p.WarrantyDurationUnit,
            p.AverageRating, p.ReviewCount,
            p.WholesaleMinQty, p.WholesaleUnitPrice, p.WholesaleNote
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

    public Task<List<ProductSearchResultDto>> SearchAsync(string q, bool onlyInStock = false) =>
        QueryVariantsAsync(searchQuery: q, categoryId: null, onlyInStock, take: 30);

    public async Task<ProductSearchResultDto?> GetByBarcodeAsync(string barcode)
    {
        // A barcode scan is the moment of an actual sale — reconciling scheduled Offers here (see
        // ProductService.GetAsync for why this is "check on read" rather than a background job)
        // matters more here than almost anywhere else, since this is what POS actually charges.
        var variantId = await _db.ProductVariants
            .AsNoTracking()
            .Where(v => v.Barcode == barcode && v.Product.Status == "ACTIVE")
            .Select(v => (Guid?)v.Id)
            .FirstOrDefaultAsync();
        if (variantId == null) return null;
        await _priceSlots.EnsureScheduledStateAsync(variantId.Value);

        var variant = await _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId.Value);
        if (variant == null) return null;
        var inv = await LoadInventoryAsync(new[] { variant.Id });
        return MapSearchResult(variant, inv, variant.AvgLandedCost);
    }

    public Task<List<ProductSearchResultDto>> BrowseAsync(Guid? categoryId, bool onlyInStock = false) =>
        // 500 cap: a defensive ceiling so a large catalog can't return its entire product_variants
        // table in one payload — generous enough that no real reseller catalog hits it in practice.
        QueryVariantsAsync(searchQuery: null, categoryId, onlyInStock, take: 500);

    // Shared by SearchAsync (text query, no category, capped at 30) and BrowseAsync (category
    // filter, no text query, capped at 500) — same ACTIVE-only/in-stock/inventory-load/mapping
    // logic either way, they only differed in which filter was applied and the result cap.
    private async Task<List<ProductSearchResultDto>> QueryVariantsAsync(
        string? searchQuery, Guid? categoryId, bool onlyInStock, int take)
    {
        var query = _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .Where(v => v.Product.Status == "ACTIVE");

        if (!string.IsNullOrWhiteSpace(searchQuery))
        {
            var q = searchQuery.Trim();
            query = query.Where(v =>
                v.Barcode == q || v.Sku.Contains(q) || v.Product.Name.Contains(q) || v.Product.Sku.Contains(q));
        }

        if (categoryId.HasValue)
            query = query.Where(v => v.Product.CategoryId == categoryId.Value);

        if (onlyInStock)
            query = query.Where(HasStockInCurrentScope());

        var variants = await query
            .OrderBy(v => v.Product.Name).ThenBy(v => v.Sku)
            .Take(take)
            .ToListAsync();

        var inv = await LoadInventoryAsync(variants.Select(v => v.Id));
        return variants.Select(v => MapSearchResult(v, inv, v.AvgLandedCost)).ToList();
    }

    // For the hawker night-entry tile grid — qty AND revenue "sold today" per variant,
    // business-scoped via the Orders join (OrderItem itself has no BusinessId). Kept out of
    // BrowseAsync/MapSearchResult since those are on the hot path for POS/search too and don't
    // need this aggregate on every call.
    public async Task<Dictionary<Guid, TodaySoldDto>> GetTodaySoldQtyByVariantAsync()
    {
        var todayUtc = DateTime.UtcNow.Date;
        var tomorrowUtc = todayUtc.AddDays(1);

        return await _db.OrderItems.AsNoTracking()
            .Where(i => i.DeletedAt == null)
            .Join(_db.Orders.AsNoTracking().Where(OrderFinancials.SoldOrderFilter(todayUtc, tomorrowUtc)),
                i => i.OrderId, o => o.Id, (i, o) => i)
            .GroupBy(i => i.VariantId)
            .Select(g => new { VariantId = g.Key, Qty = g.Sum(x => x.Qty), Amount = g.Sum(x => x.Qty * x.UnitPrice) })
            .ToDictionaryAsync(x => x.VariantId, x => new TodaySoldDto(x.Qty, x.Amount));
    }

    // Owner/Manager only (enforced at the controller — GTR-10). Scoped to HAWKER channel
    // specifically, matching what Night Entry's "Today's Profit" tile has always meant (today's
    // door-to-door sales profit), not shop POS or online-channel profit.
    public async Task<decimal> GetTodayHawkerProfitAsync()
    {
        var todayUtc = DateTime.UtcNow.Date;
        var tomorrowUtc = todayUtc.AddDays(1);

        return await _db.OrderItems.AsNoTracking()
            .Where(i => i.DeletedAt == null)
            .Join(
                _db.Orders.AsNoTracking()
                    .Where(OrderFinancials.SoldOrderFilter(todayUtc, tomorrowUtc))
                    .Where(o => o.Channel == "HAWKER"),
                i => i.OrderId, o => o.Id, (i, o) => i)
            .SumAsync(i => i.Qty * (i.UnitPrice - (i.UnitCostSnapshot ?? 0)));
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
        ValidateWholesaleTier(request.WholesaleMinQty, request.WholesaleUnitPrice, request.SellingPrice);

        var productName = request.Name.Trim();
        if (productName.Length == 0) throw new ArgumentException("Product name is required.");

        SuggestedProduct? suggestedProduct = null;
        if (request.SuggestedProductId.HasValue)
        {
            var categorySuggestedId = await _db.Categories
                .Where(c => c.Id == request.CategoryId)
                .Select(c => c.SuggestedCategoryId)
                .FirstOrDefaultAsync();

            if (categorySuggestedId is null)
                throw new ArgumentException("Selected product suggestion is not available for this category.");

            suggestedProduct = await _db.SuggestedProducts
                .FirstOrDefaultAsync(sp => sp.Id == request.SuggestedProductId.Value
                    && sp.SuggestedCategoryId == categorySuggestedId.Value
                    && sp.IsActive);

            if (suggestedProduct is null)
                throw new ArgumentException("Selected product suggestion is not available for this category.");

            if (!string.Equals(productName, suggestedProduct.Name, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Selected product suggestion does not match the product name.");
        }

        var combinations = request.VariantCombinations;

        // Fail fast, before anything is persisted, rather than leaving a product created
        // half-finished if quantities are invalid or branch resolution turns out ambiguous.
        Guid? branchId = null;
        if (combinations != null)
        {
            if (combinations.Count == 0) throw new ArgumentException("At least one variant is required.");
            foreach (var c in combinations)
            {
                if (c.Qty <= 0) throw new ArgumentException("Quantity must be greater than zero for every variant.");
                if (c.CostPrice < 0) throw new ArgumentException("Cost cannot be negative.");
            }
            branchId = await ResolveSingleBranchIdAsync(request.BranchId);
        }

        var sku = await GenerateSkuAsync();
        var usesSuggestedImage = suggestedProduct?.ImageUrl is { Length: > 0 } suggestedImageUrl
            && string.Equals(request.ImageUrl, suggestedImageUrl, StringComparison.OrdinalIgnoreCase);

        var product = new Product
        {
            BusinessId = _business.CurrentBusinessId,
            CategoryId = request.CategoryId,
            SuggestedProductId = suggestedProduct?.Id,
            Name = productName,
            Sku = sku,
            ImageUrl = request.ImageUrl,
            ImageSource = usesSuggestedImage ? "COMMON" : "INDIVIDUAL",
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
            WarrantyDurationUnit = request.WarrantyDurationUnit,
            WholesaleMinQty = request.WholesaleMinQty,
            WholesaleUnitPrice = request.WholesaleUnitPrice,
            WholesaleNote = request.WholesaleNote?.Trim() is { Length: > 0 } note ? note : null
        };
        _db.Products.Add(product);
        await _db.SaveChangesAsync(); // get product Id

        // Bare default variant (no stock/cost) when combinations weren't supplied — internal
        // bulk-add flows only, see CreateProductRequest.VariantCombinations.
        var comboList = combinations ?? new List<VariantCombinationInput> { new(new Dictionary<string, string>(), 0, 0) };
        var createdVariants = new List<(ProductVariant Variant, decimal Qty, decimal CostPrice)>();
        for (int i = 0; i < comboList.Count; i++)
        {
            var combo = comboList[i];
            var variantJson = System.Text.Json.JsonSerializer.Serialize(combo.Values);
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
            createdVariants.Add((variant, combo.Qty, combo.CostPrice));
        }
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Product", product.Id);

        // Only the default variant "owns" SellingPrice at creation (every combo starts with
        // PriceOverride null) — see CreateOriginalPriceSlotAsync for why non-default variants are
        // deliberately skipped.
        var defaultVariant = createdVariants.First(cv => cv.Variant.IsDefault).Variant;
        await CreateOriginalPriceSlotAsync(defaultVariant.Id, product.SellingPrice, userId);

        if (combinations != null)
        {
            foreach (var (variant, qty, costPrice) in createdVariants)
                await SetVariantOpeningStockAndCostAsync(variant.Id, qty, costPrice, branchId!.Value, userId);
        }

        return (ProductDetailDto)(await GetAsync(product.Id, true));
    }

    // The one place every "here's the quantity and what it cost" entry point converges — new
    // product variants, a new variant added later, and the "add cost for existing stock"
    // retrofit all call this. A single stock_movement carries both the quantity and the cost
    // together, so it always shows as one clear entry in Adjustment History — no separate
    // purchase trip, no hidden receive event.
    private async Task SetVariantOpeningStockAndCostAsync(Guid variantId, decimal qty, decimal costPerUnit, Guid branchId, Guid userId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var inv = await _db.BranchVariantInventories
                .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", branchId, variantId)
                .FirstOrDefaultAsync();

            var currentOnHand = inv?.OnHand ?? 0;
            var delta = qty - currentOnHand;

            if (inv == null)
            {
                inv = new BranchVariantInventory { BranchId = branchId, VariantId = variantId, OnHand = 0, Committed = 0, Damaged = 0 };
                _db.BranchVariantInventories.Add(inv);
            }
            inv.OnHand = qty;

            _db.StockMovements.Add(new StockMovement
            {
                BusinessId = _business.CurrentBusinessId,
                BranchId = branchId,
                VariantId = variantId,
                MovementType = "ADJUSTMENT",
                Qty = delta,
                ReferenceType = "ExistingStockCost",
                UserId = userId,
                Reason = "EXISTING_STOCK",
                Note = $"Stock recorded at ৳{costPerUnit:0.##}/unit"
            });

            var variant = await _db.ProductVariants.FirstAsync(v => v.Id == variantId);
            variant.AvgLandedCost = costPerUnit;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "ProductVariant", variantId);
    }

    // "I already own this" — for a variant that has never had any real purchase cost recorded
    // (AvgLandedCost == 0). Only usable once per variant in that state; once real cost exists,
    // restocking goes through the normal Purchases flow instead, so genuine cost history never
    // gets silently overwritten.
    public async Task<VariantDto> RecordExistingStockCostAsync(Guid variantId, RecordExistingStockCostRequest request, Guid userId)
    {
        if (request.Qty <= 0) throw new ArgumentException("Quantity must be greater than zero.");
        if (request.CostPerUnit < 0) throw new ArgumentException("Cost cannot be negative.");

        var variant = await _db.ProductVariants.FirstOrDefaultAsync(v => v.Id == variantId)
            ?? throw new KeyNotFoundException("Variant not found.");

        if (variant.AvgLandedCost > 0)
            throw new ArgumentException("This item already has recorded purchase cost — add more stock through Purchases instead.");

        var branchId = await ResolveSingleBranchIdAsync(request.BranchId);
        await SetVariantOpeningStockAndCostAsync(variantId, request.Qty, request.CostPerUnit, branchId, userId);

        var onHand = await _db.BranchVariantInventories
            .Where(i => i.BranchId == branchId && i.VariantId == variantId)
            .SumAsync(i => (decimal?)i.OnHand) ?? 0;
        var updated = await _db.ProductVariants.AsNoTracking().FirstAsync(v => v.Id == variantId);
        return MapVariantDto(updated, new Dictionary<Guid, decimal> { [variantId] = onHand });
    }

    private async Task<Guid> ResolveSingleBranchIdAsync(Guid? requestedBranchId)
    {
        if (requestedBranchId.HasValue) return requestedBranchId.Value;
        if (_business.CurrentBranchId.HasValue) return _business.CurrentBranchId.Value;

        var activeBranches = await _db.Branches.Where(b => b.IsActive).Select(b => b.Id).ToListAsync();
        if (activeBranches.Count == 1) return activeBranches[0];
        if (activeBranches.Count == 0) throw new InvalidOperationException("No active branch exists for this business.");
        throw new ArgumentException("This business has multiple branches — please select which branch this stock belongs to.");
    }

    public async Task<ProductDetailDto> UpdateAsync(Guid id, UpdateProductRequest request, Guid userId)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Product not found.");

        // Optimistic concurrency check
        if (!product.RowVer.SequenceEqual(request.RowVer))
            throw new DbUpdateConcurrencyException();

        ValidateWholesaleTier(request.WholesaleMinQty, request.WholesaleUnitPrice, request.SellingPrice);

        product.CategoryId = request.CategoryId;
        product.Name = request.Name.Trim();
        if (!string.Equals(product.ImageUrl, request.ImageUrl, StringComparison.Ordinal))
        {
            product.ImageUrl = request.ImageUrl;
            product.ImageSource = "INDIVIDUAL";
        }
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
        product.WholesaleMinQty = request.WholesaleMinQty;
        product.WholesaleUnitPrice = request.WholesaleUnitPrice;
        product.WholesaleNote = request.WholesaleNote?.Trim() is { Length: > 0 } note ? note : null;

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Product", product.Id);
        return (ProductDetailDto)(await GetAsync(product.Id, true));
    }

    // Both null (wholesale off) is always valid. Otherwise both must be present: MinQty >= 2 (a
    // value of 1 would silently replace the retail price on every single sale), and the
    // wholesale rate must actually be cheaper than retail or the "discount" is meaningless.
    private static void ValidateWholesaleTier(decimal? minQty, decimal? unitPrice, decimal sellingPrice)
    {
        if (minQty == null && unitPrice == null) return;
        if (minQty == null || unitPrice == null)
            throw new ArgumentException("Wholesale minimum quantity and price must both be set, or both left empty.");
        if (minQty < 2)
            throw new ArgumentException("Wholesale minimum quantity must be at least 2.");
        if (unitPrice >= sellingPrice)
            throw new ArgumentException("Wholesale price must be lower than the retail price.");
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
        if (request.Qty <= 0) throw new ArgumentException("Quantity must be greater than zero.");
        if (request.CostPrice < 0) throw new ArgumentException("Cost cannot be negative.");

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId)
            ?? throw new KeyNotFoundException("Product not found.");

        // Fail fast, before anything is persisted, if branch resolution turns out ambiguous.
        var branchId = await ResolveSingleBranchIdAsync(request.BranchId);

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

        // Same rule as CreateAsync: only give this variant an initial slot if it actually owns a
        // starting price (default-with-no-override resolves to Product.SellingPrice; an explicit
        // PriceOverride is its own starting price). A non-default variant with no override is left
        // alone so it keeps inheriting Product.SellingPrice dynamically.
        if (request.IsDefault || request.PriceOverride.HasValue)
            await CreateOriginalPriceSlotAsync(variant.Id, request.PriceOverride ?? product.SellingPrice, userId);

        await SetVariantOpeningStockAndCostAsync(variant.Id, request.Qty, request.CostPrice, branchId, userId);

        var onHand = await _db.BranchVariantInventories
            .Where(i => i.BranchId == branchId && i.VariantId == variant.Id)
            .SumAsync(i => (decimal?)i.OnHand) ?? 0;
        var updated = await _db.ProductVariants.AsNoTracking().FirstAsync(v => v.Id == variant.Id);
        return MapVariantDto(updated, new Dictionary<Guid, decimal> { [variant.Id] = onHand });
    }

    // Redistributes a single variant's existing on-hand stock into several new named variants —
    // no new cost entry, since it's the same physical batch just being recategorized (e.g. a
    // product added without a size/color matrix, now being split into real variants). Only
    // supported from a single starting variant: splitting an already-multi-variant product would
    // mean deciding which existing variant(s) to pull from, which this doesn't attempt.
    public async Task<List<VariantDto>> SplitStockIntoVariantsAsync(Guid productId, SplitStockIntoVariantsRequest request, Guid userId)
    {
        if (request.Items.Count < 2) throw new ArgumentException("Split into at least 2 variants.");
        foreach (var item in request.Items)
            if (item.Qty <= 0) throw new ArgumentException("Quantity must be greater than zero for every variant.");

        var product = await _db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == productId)
            ?? throw new KeyNotFoundException("Product not found.");

        var activeVariants = product.Variants.Where(v => v.DeletedAt == null).ToList();
        if (activeVariants.Count != 1)
            throw new ArgumentException("Splitting into variants is only available while the product has a single variant.");

        var sourceVariant = activeVariants.First();
        if (sourceVariant.Id != request.SourceVariantId)
            throw new ArgumentException("Source variant does not match the product's current variant.");

        var branchId = await ResolveSingleBranchIdAsync(request.BranchId);

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var inv = await _db.BranchVariantInventories
                .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", branchId, sourceVariant.Id)
                .FirstOrDefaultAsync();
            var currentOnHand = inv?.OnHand ?? 0;
            var requestedTotal = request.Items.Sum(i => i.Qty);
            if (requestedTotal != currentOnHand)
                throw new ArgumentException($"Split quantities must add up to exactly the current stock ({currentOnHand}).");

            var sourceCost = sourceVariant.AvgLandedCost;
            var results = new List<ProductVariant> { sourceVariant };

            // First item reuses the source variant's identity — same Sku/Barcode, just relabeled
            // and its stock narrowed down to its share of the split.
            var first = request.Items[0];
            sourceVariant.VariantValuesJson = System.Text.Json.JsonSerializer.Serialize(first.Values);
            if (inv == null)
            {
                inv = new BranchVariantInventory { BranchId = branchId, VariantId = sourceVariant.Id, OnHand = 0, Committed = 0, Damaged = 0 };
                _db.BranchVariantInventories.Add(inv);
            }
            inv.OnHand = first.Qty;
            _db.StockMovements.Add(new StockMovement
            {
                BusinessId = _business.CurrentBusinessId,
                BranchId = branchId,
                VariantId = sourceVariant.Id,
                MovementType = "ADJUSTMENT",
                Qty = first.Qty - currentOnHand,
                ReferenceType = "VariantSplit",
                UserId = userId,
                Reason = "SPLIT",
                Note = "Split from single stock into variants"
            });

            for (int i = 1; i < request.Items.Count; i++)
            {
                var item = request.Items[i];
                var barcode = await GenerateBarcodeAsync();
                var variantSku = $"{product.Sku}-{(activeVariants.Count + i):D2}";
                var newVariant = new ProductVariant
                {
                    BusinessId = _business.CurrentBusinessId,
                    ProductId = productId,
                    VariantValuesJson = System.Text.Json.JsonSerializer.Serialize(item.Values),
                    Sku = variantSku,
                    Barcode = barcode,
                    IsDefault = false,
                    AvgLandedCost = sourceCost
                };
                _db.ProductVariants.Add(newVariant);
                await _db.SaveChangesAsync(); // need the new variant's Id before referencing it below

                _db.BranchVariantInventories.Add(new BranchVariantInventory
                {
                    BranchId = branchId,
                    VariantId = newVariant.Id,
                    OnHand = item.Qty,
                    Committed = 0,
                    Damaged = 0
                });
                _db.StockMovements.Add(new StockMovement
                {
                    BusinessId = _business.CurrentBusinessId,
                    BranchId = branchId,
                    VariantId = newVariant.Id,
                    MovementType = "ADJUSTMENT",
                    Qty = item.Qty,
                    ReferenceType = "VariantSplit",
                    UserId = userId,
                    Reason = "SPLIT",
                    Note = "Split from single stock into variants"
                });
                results.Add(newVariant);
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Product", productId);

        var allVariants = await _db.ProductVariants.AsNoTracking()
            .Where(v => v.ProductId == productId && v.DeletedAt == null)
            .OrderBy(v => v.Sku)
            .ToListAsync();
        var invMap = await LoadInventoryAsync(allVariants.Select(v => v.Id));
        return allVariants.Select(v => MapVariantDto(v, invMap)).ToList();
    }

    // Units sold per day (7d/30d) or per 7-day bucket (90d/180d) — daily buckets over 6 months
    // would be an unreadable ~180-bar strip on a phone screen, so the longer ranges collapse into
    // weeks instead. Deliberately NOT OrderFinancials.SoldOrderFilter (the CreatedAt-based
    // definition Dashboard/Sales Summary/P&L use, which counts an order the instant it's placed,
    // before it's even confirmed, and never nets out returns) — a per-product "is this actually
    // selling" trend is misleading if it counts orders that haven't stuck yet. Matches the
    // stricter definition PopularityService already uses for recent-sales ranking instead:
    // OrderStatus == COMPLETED, FulfillmentStatus != RETURNED, bucketed by ConfirmedAt. This
    // means this tab's totals will NOT reconcile with the Dashboard/P&L numbers — that's expected,
    // not a bug; they're deliberately answering different questions (committed revenue vs. sales
    // that actually happened).
    private static readonly Dictionary<string, (int Days, int BucketDays)> SalesRangeOptions = new()
    {
        ["7d"] = (7, 1),
        ["30d"] = (30, 1),
        ["90d"] = (90, 7),
        ["180d"] = (180, 7),
    };

    public async Task<List<ProductSalesPointDto>> GetSalesTimeseriesAsync(Guid productId, string range)
    {
        if (!SalesRangeOptions.TryGetValue(range, out var opt))
            throw new ArgumentException("Invalid range. Expected one of: 7d, 30d, 90d, 180d.");

        var today = DateTime.UtcNow.Date;
        var from = today.AddDays(-(opt.Days - 1));
        var toExclusive = today.AddDays(1);

        var sales = await _db.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == "COMPLETED" &&
                        o.FulfillmentStatus != "RETURNED" &&
                        o.ConfirmedAt != null &&
                        o.ConfirmedAt >= from && o.ConfirmedAt < toExclusive)
            .SelectMany(o => o.Items
                .Where(i => i.DeletedAt == null && i.Variant != null && i.Variant.ProductId == productId)
                .Select(i => new { o.Channel, ConfirmedAt = o.ConfirmedAt!.Value, i.Qty, i.UnitPrice, i.UnitCostSnapshot }))
            .ToListAsync();

        var points = new List<ProductSalesPointDto>();
        for (var offset = 0; offset < opt.Days; offset += opt.BucketDays)
        {
            var bucketStart = from.AddDays(offset);
            var bucketEndExclusive = from.AddDays(Math.Min(offset + opt.BucketDays, opt.Days));
            var bucketSales = sales.Where(s => s.ConfirmedAt >= bucketStart && s.ConfirmedAt < bucketEndExclusive).ToList();
            var qty = bucketSales.Sum(s => s.Qty);
            var revenue = bucketSales.Sum(s => s.Qty * s.UnitPrice);
            var profit = bucketSales.Sum(s => s.Qty * (s.UnitPrice - s.UnitCostSnapshot.GetValueOrDefault()));
            var channels = bucketSales
                .GroupBy(s => s.Channel)
                .Select(g => new ProductSalesChannelDto(
                    g.Key,
                    g.Sum(s => s.Qty),
                    g.Sum(s => s.Qty * s.UnitPrice),
                    g.Sum(s => s.Qty * (s.UnitPrice - s.UnitCostSnapshot.GetValueOrDefault()))
                ))
                .OrderByDescending(c => c.Qty)
                .ToList();
            points.Add(new ProductSalesPointDto(DateOnly.FromDateTime(bucketStart), qty, revenue, profit, channels));
        }
        return points;
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
        inv.TryGetValue(v.Id, out var available) ? available : 0m, v.RowVer
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
    //
    // Returns real sellable stock (OnHand minus Committed/Damaged), not raw OnHand — same
    // formula as HasStockInCurrentScope just above. Previously this summed OnHand alone, so the
    // product detail page and the New Order product picker could both show a number larger than
    // what a customer could actually be sold right now (already-reserved and damaged units were
    // silently included), even though the "only show in-stock" filter next to it used the
    // correct formula the whole time.
    private async Task<Dictionary<Guid, decimal>> LoadInventoryAsync(IEnumerable<Guid> variantIds)
    {
        var ids = variantIds.ToList();
        return await _db.BranchVariantInventories
            .Where(i => ids.Contains(i.VariantId) && (_db.CurrentBranchId == null || i.BranchId == _db.CurrentBranchId))
            .GroupBy(i => i.VariantId)
            .Select(g => new { VariantId = g.Key, Available = g.Sum(x => x.OnHand - x.Committed - x.Damaged) })
            .ToDictionaryAsync(x => x.VariantId, x => x.Available);
    }

    // Order count + profit per product for the list-card stat strip — one batched query for the
    // whole page, same convention as LoadInventoryAsync, instead of a query per card. Only
    // COMPLETED, non-returned orders count, matching PopularityService's sales convention.
    // PackagingCostPerUnit isn't applied here (it can change over time and isn't snapshotted per
    // item) — it's subtracted once in MapSummary using the product's current value.
    private async Task<Dictionary<Guid, (int OrderCount, decimal QtySold, decimal RawProfit)>> LoadOrderStatsAsync(IEnumerable<Guid> productIds)
    {
        var ids = productIds.ToList();
        return await _db.OrderItems
            .Where(oi => ids.Contains(oi.Variant.ProductId) &&
                         oi.Order.OrderStatus == "COMPLETED" &&
                         oi.Order.FulfillmentStatus != "RETURNED")
            .GroupBy(oi => oi.Variant.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                OrderCount = g.Select(x => x.OrderId).Distinct().Count(),
                QtySold = g.Sum(x => x.Qty),
                RawProfit = g.Sum(x => x.Qty * (x.UnitPrice - (x.UnitCostSnapshot ?? 0)))
            })
            .ToDictionaryAsync(x => x.ProductId, x => (x.OrderCount, x.QtySold, x.RawProfit));
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
        inv.TryGetValue(v.Id, out var available) ? available : 0m,
        avgLandedCost,
        v.Product.MarketPrice,
        v.Product.WholesaleMinQty,
        v.Product.WholesaleUnitPrice,
        v.Product.CategoryId
    );

    private static ProductSummaryDto MapSummary(
        Product p,
        Dictionary<Guid, decimal> inv,
        Dictionary<Guid, (int OrderCount, decimal QtySold, decimal RawProfit)> orderStats)
    {
        var defaultVariant = p.Variants.FirstOrDefault(v => v.IsDefault) ?? p.Variants.FirstOrDefault();
        var stats = orderStats.TryGetValue(p.Id, out var s) ? s : (OrderCount: 0, QtySold: 0m, RawProfit: 0m);
        var totalProfit = stats.RawProfit - stats.QtySold * p.PackagingCostPerUnit;

        return new(
            p.Id, p.Name, p.Sku, p.ImageUrl, p.UnitCode, p.SellingPrice, p.MarketPrice, p.MarketplacePrice,
            p.PackagingCostPerUnit, p.Status, p.Category?.Name ?? "", p.Variants.Count,
            (int)p.Variants.Sum(v => inv.TryGetValue(v.Id, out var available) ? available : 0m),
            p.LowStockThreshold,
            defaultVariant?.AvgLandedCost ?? 0,
            p.AverageRating, p.ReviewCount,
            stats.OrderCount, totalProfit,
            p.ShowOnMarketplace,
            p.WholesaleMinQty, p.WholesaleUnitPrice
        );
    }
}
