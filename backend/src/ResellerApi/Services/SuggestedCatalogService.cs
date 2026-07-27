using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.DTOs.CatalogTemplates;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class SuggestedCatalogService : ISuggestedCatalogService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IProductService _products;
    private readonly IPurchaseTripService _purchaseTrips;
    private readonly IActivityLogService _log;

    public SuggestedCatalogService(
        AppDbContext db, IBusinessContext business, IProductService products,
        IPurchaseTripService purchaseTrips, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _products = products;
        _purchaseTrips = purchaseTrips;
        _log = log;
    }

    public async Task<List<SuggestedCategoryDto>> GetSuggestedCategoriesAsync()
    {
        var addedIds = await _db.Categories
            .Where(c => c.SuggestedCategoryId != null)
            .Select(c => c.SuggestedCategoryId!.Value)
            .ToListAsync();

        var all = await _db.SuggestedCategories
            .Where(sc => sc.IsActive)
            .OrderBy(sc => sc.BusinessTypeCode).ThenBy(sc => sc.SortOrder)
            .ToListAsync();

        return all.Select(sc => new SuggestedCategoryDto(
            sc.Id, sc.BusinessTypeCode, sc.Name, sc.DefaultUnit, addedIds.Contains(sc.Id)
        )).ToList();
    }

    public async Task<List<CategoryDto>> AddCategoriesAsync(List<Guid> suggestedCategoryIds, Guid userId)
    {
        var alreadyAdded = await _db.Categories
            .Where(c => c.SuggestedCategoryId != null && suggestedCategoryIds.Contains(c.SuggestedCategoryId!.Value))
            .Select(c => c.SuggestedCategoryId!.Value)
            .ToListAsync();

        var toAdd = await _db.SuggestedCategories
            .Include(sc => sc.Fields)
            .Where(sc => suggestedCategoryIds.Contains(sc.Id) && !alreadyAdded.Contains(sc.Id))
            .ToListAsync();

        var created = new List<CategoryDto>();
        foreach (var suggested in toAdd)
        {
            var cat = new Category
            {
                BusinessId = _business.CurrentBusinessId,
                SuggestedCategoryId = suggested.Id,
                Name = suggested.Name,
                DefaultUnit = suggested.DefaultUnit
            };
            _db.Categories.Add(cat);
            await _db.SaveChangesAsync();

            var fields = new List<CategoryField>();
            foreach (var fieldDef in suggested.Fields.OrderBy(f => f.SortOrder))
            {
                var field = new CategoryField
                {
                    CategoryId = cat.Id,
                    Name = fieldDef.Name,
                    FieldType = fieldDef.FieldType,
                    OptionsJson = fieldDef.OptionsJson,
                    IsRequired = fieldDef.IsRequired,
                    IsVariant = fieldDef.IsVariant,
                    IsPerLot = fieldDef.IsPerLot,
                    SortOrder = fieldDef.SortOrder
                };
                _db.CategoryFields.Add(field);
                fields.Add(field);
            }
            if (fields.Count > 0) await _db.SaveChangesAsync();

            await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Category", cat.Id);

            created.Add(new CategoryDto(
                cat.Id, cat.Name, cat.NameBn, cat.DefaultUnit,
                fields.Select(f => new CategoryFieldDto(
                    f.Id, f.Name, f.FieldType, f.OptionsJson, f.IsRequired, f.IsVariant, f.IsPerLot, f.SortOrder
                )).ToList(),
                null, null, null
            ));
        }

        return created;
    }

    public async Task<List<CategoryWithSuggestionsDto>> GetCategoriesWithSuggestionsAsync()
    {
        var categories = await _db.Categories
            .Where(c => c.SuggestedCategoryId != null)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new { c.Id, c.Name, c.SuggestedCategoryId })
            .ToListAsync();

        var existingProductNamesByCategory = await _db.Products
            .Where(p => categories.Select(c => c.Id).Contains(p.CategoryId))
            .Select(p => new { p.CategoryId, p.Name })
            .ToListAsync();

        var suggestedCounts = await _db.SuggestedProducts
            .Where(sp => sp.IsActive && categories.Select(c => c.SuggestedCategoryId).Contains(sp.SuggestedCategoryId))
            .Select(sp => new { sp.SuggestedCategoryId, sp.Name })
            .ToListAsync();

        return categories.Select(c =>
        {
            var alreadyNamed = existingProductNamesByCategory
                .Where(p => p.CategoryId == c.Id)
                .Select(p => p.Name)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var available = suggestedCounts
                .Where(sp => sp.SuggestedCategoryId == c.SuggestedCategoryId && !alreadyNamed.Contains(sp.Name))
                .Count();

            return new CategoryWithSuggestionsDto(c.Id, c.Name, available);
        }).ToList();
    }

    public async Task<List<SuggestedProductDto>> GetSuggestedProductsAsync(Guid categoryId)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == categoryId)
            ?? throw new KeyNotFoundException("Category not found.");

        if (category.SuggestedCategoryId is null)
            return new List<SuggestedProductDto>();

        var existingProducts = await _db.Products
            .Where(p => p.CategoryId == categoryId)
            .Select(p => new
            {
                p.Name,
                p.SellingPrice,
                DefaultVariantId = p.Variants.Where(v => v.IsDefault).Select(v => (Guid?)v.Id).FirstOrDefault()
            })
            .ToListAsync();

        var defaultVariantIds = existingProducts
            .Where(p => p.DefaultVariantId != null)
            .Select(p => p.DefaultVariantId!.Value)
            .ToList();
        var onHandByVariant = await _db.BranchVariantInventories
            .Where(vi => defaultVariantIds.Contains(vi.VariantId))
            .GroupBy(vi => vi.VariantId)
            .Select(g => new { VariantId = g.Key, OnHand = g.Sum(x => x.OnHand) })
            .ToDictionaryAsync(x => x.VariantId, x => x.OnHand);

        var existingByName = existingProducts
            .GroupBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var suggestions = await _db.SuggestedProducts
            .Where(sp => sp.SuggestedCategoryId == category.SuggestedCategoryId && sp.IsActive)
            .OrderBy(sp => sp.SortOrder)
            .ToListAsync();

        return suggestions.Select(sp =>
        {
            existingByName.TryGetValue(sp.Name, out var existing);
            decimal? qty = existing?.DefaultVariantId != null && onHandByVariant.TryGetValue(existing.DefaultVariantId.Value, out var onHand)
                ? onHand
                : null;
            return new SuggestedProductDto(sp.Id, sp.Name, existing != null, existing?.SellingPrice, qty);
        }).ToList();
    }

    public async Task<List<AddSuggestedProductsResultItem>> AddProductsAsync(
        AddSuggestedProductsRequest request, Guid userId, bool isOwner)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId)
            ?? throw new KeyNotFoundException("Category not found.");

        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0) throw new ArgumentException("Quantity must be greater than zero for every item.");
            if (item.UnitCost < 0) throw new ArgumentException("Unit cost cannot be negative.");
        }

        var results = new List<AddSuggestedProductsResultItem>();
        var openingStockItems = new List<(Guid VariantId, decimal Qty, decimal UnitCost)>();

        foreach (var item in request.Items)
        {
            var name = item.Name.Trim();
            if (name.Length == 0) continue;

            var createReq = new CreateProductRequest(
                CategoryId: category.Id,
                Name: name,
                ImageUrl: null,
                Description: null,
                DefectNotes: null,
                UnitCode: category.DefaultUnit,
                SellingPrice: item.SellingPrice ?? 0,
                MarketPrice: null,
                PackagingCostPerUnit: 0,
                LowStockThreshold: 5,
                AttributesJson: null,
                Note: null,
                VariantCombinations: null, // single default variant, no stock/cost yet — this flow has its own opening-stock path, see ReceiveOpeningStockAsync below
                BranchId: null,
                WarrantyDurationValue: null,
                WarrantyDurationUnit: null
            );
            var created = await _products.CreateAsync(createReq, userId);

            var defaultVariant = created.Variants.First(v => v.IsDefault);
            openingStockItems.Add((defaultVariant.Id, item.Quantity, item.UnitCost));

            results.Add(new AddSuggestedProductsResultItem(created.Id, created.Name, true));
        }

        if (openingStockItems.Count > 0)
            await ReceiveOpeningStockAsync(openingStockItems, request.BranchId, userId, isOwner);

        return results;
    }

    // Drives the real purchase-trip pipeline (DRAFT trip -> items -> owner-approved receive
    // session) so opening stock gets a proper stock_movement + landed cost, same as any other
    // purchase — no shortcut around the mandatory stock mutation pattern.
    private async Task ReceiveOpeningStockAsync(
        List<(Guid VariantId, decimal Qty, decimal UnitCost)> items, Guid? branchId, Guid userId, bool isOwner)
    {
        var trip = await _purchaseTrips.CreateAsync(
            new CreatePurchaseTripRequest("OPENING_BALANCE", "Opening stock — Catalog Templates", branchId),
            userId);

        var sessionItems = new List<SessionItemInput>();
        foreach (var (variantId, qty, unitCost) in items)
        {
            var purchaseItem = await _purchaseTrips.AddItemAsync(
                trip.Id,
                new AddPurchaseItemRequest(variantId, qty, unitCost * qty, null, null, 0, 0, null),
                userId);
            sessionItems.Add(new SessionItemInput(purchaseItem.Id, qty, 0, "{}"));
        }

        await _purchaseTrips.CreateReceiveSessionAsync(
            trip.Id,
            new CreateReceiveSessionRequest(DateTime.UtcNow, "OTHER", null, "Opening stock — Catalog Templates", sessionItems),
            userId,
            isOwner);
    }
}
