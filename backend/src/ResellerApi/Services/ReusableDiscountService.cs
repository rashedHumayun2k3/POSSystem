using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public sealed class ReusableDiscountService(
    AppDbContext db,
    IBusinessContext business,
    IPriceSlotService priceSlots) : IReusableDiscountService
{
    public async Task<List<ReusableDiscountDto>> ListAsync(bool includeArchived = false)
    {
        var query = db.ReusableDiscounts.AsNoTracking();
        if (!includeArchived) query = query.Where(d => !d.IsArchived);
        var discounts = await query.OrderByDescending(d => d.CreatedAt).ToListAsync();
        var ids = discounts.Select(d => d.Id).ToList();
        var counts = await db.PriceSlots.IgnoreQueryFilters().AsNoTracking()
            .Where(s => s.BusinessId == business.CurrentBusinessId && s.ReusableDiscountId.HasValue && ids.Contains(s.ReusableDiscountId.Value))
            .GroupBy(s => s.ReusableDiscountId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Select(s => s.VariantId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count);
        var now = DateTime.UtcNow;
        var activeCounts = await db.PriceSlots.AsNoTracking()
            .Where(s => s.BusinessId == business.CurrentBusinessId && s.ReusableDiscountId.HasValue
                && ids.Contains(s.ReusableDiscountId.Value) && s.DeletedAt == null && s.IsActive
                && s.StartDate <= now && (s.EndDate == null || s.EndDate >= now))
            .GroupBy(s => s.ReusableDiscountId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Select(s => s.VariantId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count);
        return discounts.Select(d => ToDto(d, counts.GetValueOrDefault(d.Id), activeCounts.GetValueOrDefault(d.Id))).ToList();
    }

    public async Task<List<AppliedDiscountVariantDto>> ListAppliedVariantsAsync(Guid id)
    {
        if (!await db.ReusableDiscounts.AsNoTracking().AnyAsync(d => d.Id == id))
            throw new KeyNotFoundException("Discount not found.");

        var applications = await db.PriceSlots.IgnoreQueryFilters().AsNoTracking()
            .Where(s => s.BusinessId == business.CurrentBusinessId && s.ReusableDiscountId == id)
            .OrderBy(s => s.Variant.Product.Name).ThenBy(s => s.Variant.Sku).ThenByDescending(s => s.CreatedAt)
            .Select(s => new AppliedDiscountVariantDto(
                s.Variant.ProductId, s.Variant.Product.Name, s.VariantId, s.Variant.Sku,
                s.Variant.VariantValuesJson, s.Price, s.IsActive, s.StartDate, s.EndDate, s.DeletedAt))
            .ToListAsync();
        return applications.GroupBy(s => s.VariantId).Select(g => g.First()).ToList();
    }

    public async Task<List<ActiveDiscountAssignmentDto>> ListActiveAssignmentsAsync()
    {
        var now = DateTime.UtcNow;
        return await db.PriceSlots.AsNoTracking()
            .Where(s => s.BusinessId == business.CurrentBusinessId && s.ReusableDiscountId != null
                && s.DeletedAt == null && s.IsActive && s.StartDate <= now
                && (s.EndDate == null || s.EndDate >= now))
            .OrderBy(s => s.Variant.Product.Category.Name)
            .ThenBy(s => s.Variant.Product.Name).ThenBy(s => s.Variant.Sku)
            .Select(s => new ActiveDiscountAssignmentDto(
                s.ReusableDiscountId!.Value, s.ReusableDiscount!.Name, s.ReusableDiscount.Percent, s.ReusableDiscount.IsArchived,
                s.Variant.Product.CategoryId, s.Variant.Product.Category.Name,
                s.Variant.ProductId, s.Variant.Product.Name,
                s.VariantId, s.Variant.Sku, s.Variant.VariantValuesJson, s.Price))
            .ToListAsync();
    }

    public async Task RemoveVariantAsync(Guid id, Guid variantId, Guid userId)
    {
        if (!await db.ReusableDiscounts.AnyAsync(d => d.Id == id))
            throw new KeyNotFoundException("Discount not found.");
        var slot = await db.PriceSlots
            .Where(s => s.BusinessId == business.CurrentBusinessId && s.ReusableDiscountId == id && s.VariantId == variantId)
            .OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("This variant has no current application of the discount.");
        var now = DateTime.UtcNow;
        if (!slot.IsActive && slot.StartDate <= now)
            throw new InvalidOperationException("This discount is no longer active on the variant.");
        if (slot.EndDate.HasValue && slot.EndDate.Value < now)
            throw new InvalidOperationException("This discount has already ended on the variant.");

        await using var transaction = await db.Database.BeginTransactionAsync();
        if (slot.IsActive)
        {
            var regularPrice = slot.RegularPriceSnapshot;
            if (regularPrice is null or <= 0)
                throw new InvalidOperationException("The regular price was not saved for this offer. Set a regular price on the product before removing it.");
            var restore = await priceSlots.CreateSlotAsync(variantId,
                new CreateSlotRequest("Original Price", regularPrice.Value, "Discount removed", now), userId);
            await priceSlots.ActivateSlotAsync(variantId, restore.Id, userId);
        }
        slot.DeletedAt = now;
        slot.UpdatedAt = now;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public async Task<ReusableDiscountDto> CreateAsync(CreateReusableDiscountRequest request, Guid userId)
    {
        var values = ValidateDefinition(request.Name, request.Percent, request.Reason, request.StartDate, request.EndDate);

        var discount = new ReusableDiscount
        {
            BusinessId = business.CurrentBusinessId,
            Name = values.Name,
            Percent = values.Percent,
            Reason = values.Reason,
            StartDate = values.StartDate,
            EndDate = values.EndDate,
            CreatedBy = userId,
        };
        db.ReusableDiscounts.Add(discount);
        await db.SaveChangesAsync();
        return ToDto(discount, 0);
    }

    public async Task<ReusableDiscountDto> UpdateAsync(Guid id, UpdateReusableDiscountRequest request)
    {
        var discount = await db.ReusableDiscounts.FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new KeyNotFoundException("Discount not found.");
        if (await db.PriceSlots.IgnoreQueryFilters().AnyAsync(s => s.BusinessId == business.CurrentBusinessId && s.ReusableDiscountId == id))
            throw new InvalidOperationException("This discount has already been applied. Archive it and create a new discount to preserve the applied price history.");

        var values = ValidateDefinition(request.Name, request.Percent, request.Reason, request.StartDate, request.EndDate);
        discount.Name = values.Name;
        discount.Percent = values.Percent;
        discount.Reason = values.Reason;
        discount.StartDate = values.StartDate;
        discount.EndDate = values.EndDate;
        discount.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return ToDto(discount, 0);
    }

    public async Task DeleteAsync(Guid id)
    {
        var discount = await db.ReusableDiscounts.FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new KeyNotFoundException("Discount not found.");
        if (await db.PriceSlots.IgnoreQueryFilters().AnyAsync(s => s.BusinessId == business.CurrentBusinessId && s.ReusableDiscountId == id))
            throw new InvalidOperationException("This discount has already been applied and cannot be deleted. Archive it to preserve the applied price history.");
        db.ReusableDiscounts.Remove(discount);
        await db.SaveChangesAsync();
    }

    public async Task<ApplyReusableDiscountResult> ApplyAsync(Guid id, ApplyReusableDiscountRequest request, Guid userId)
    {
        var discount = await db.ReusableDiscounts.FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new KeyNotFoundException("Discount not found.");
        if (discount.IsArchived) throw new InvalidOperationException("Restore this discount before applying it.");
        if (discount.EndDate.HasValue && discount.EndDate.Value < DateTime.UtcNow)
            throw new InvalidOperationException("This discount has expired. Create a new discount with future dates.");

        var categoryIds = (request.CategoryIds ?? []).Where(x => x != Guid.Empty).Distinct().ToArray();
        var productIds = (request.ProductIds ?? []).Where(x => x != Guid.Empty).Distinct().ToArray();
        if (request.AllProducts && (categoryIds.Length > 0 || productIds.Length > 0))
            throw new ArgumentException("Choose all products or selected categories/products, not both.");
        if (!request.AllProducts && categoryIds.Length == 0 && productIds.Length == 0)
            throw new ArgumentException("Choose all products, at least one category, or at least one product.");

        if (categoryIds.Length > 0)
        {
            var validCategories = await db.Categories.AsNoTracking().Where(c => categoryIds.Contains(c.Id))
                .Select(c => c.Id).ToListAsync();
            if (validCategories.Count != categoryIds.Length)
                throw new ArgumentException("One or more selected categories are no longer available.");
        }

        Guid[] selectedCategoryIds = categoryIds.Length == 0 ? Array.Empty<Guid>() : await db.Categories.AsNoTracking()
            .Where(c => categoryIds.Contains(c.Id) || (c.ParentCategoryId.HasValue && categoryIds.Contains(c.ParentCategoryId.Value)))
            .Select(c => c.Id).ToArrayAsync();
        if (productIds.Length > 0)
        {
            var validProducts = await db.Products.AsNoTracking().Where(p => productIds.Contains(p.Id))
                .Select(p => p.Id).ToListAsync();
            if (validProducts.Count != productIds.Length)
                throw new ArgumentException("One or more selected products are no longer available.");
        }

        var productsQuery = db.Products.Where(p => p.Status == "ACTIVE");
        if (!request.AllProducts)
        {
            var hasCategories = selectedCategoryIds.Length > 0;
            var hasProducts = productIds.Length > 0;
            productsQuery = productsQuery.Where(p =>
                (hasCategories && selectedCategoryIds.Contains(p.CategoryId)) ||
                (hasProducts && productIds.Contains(p.Id)));
        }
        var products = await productsQuery.Include(p => p.Variants).ToListAsync();
        var variants = products.SelectMany(p => p.Variants.Where(v => v.DeletedAt == null).Select(v => (Product: p, Variant: v))).ToList();
        if (variants.Count == 0) throw new InvalidOperationException("No active product variants were found for this selection.");

        var variantIds = variants.Select(x => x.Variant.Id).ToArray();
        var now = DateTime.UtcNow;
        var alreadyApplied = await db.PriceSlots.AsNoTracking()
            .Where(s => variantIds.Contains(s.VariantId) && s.ReusableDiscountId == id && s.DeletedAt == null
                && (s.IsActive || s.StartDate > now) && (s.EndDate == null || s.EndDate >= now))
            .Select(s => s.VariantId).Distinct().ToArrayAsync();
        var alreadyAppliedIds = alreadyApplied.ToHashSet();
        variants = variants.Where(x => !alreadyAppliedIds.Contains(x.Variant.Id)).ToList();
        if (variants.Count == 0) throw new InvalidOperationException("This discount is already applied to every selected variant.");
        var existingSlots = await db.PriceSlots.AsNoTracking()
            .Where(s => variantIds.Contains(s.VariantId) && s.DeletedAt == null)
            .Select(s => new ExistingSlot(s.VariantId, s.Label, s.Price, s.RegularPriceSnapshot, s.IsActive, s.CreatedAt))
            .ToListAsync();
        var originals = existingSlots.Where(s => s.Label == "Original Price")
            .GroupBy(s => s.VariantId).ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.CreatedAt).First().Price);
        var active = existingSlots.Where(s => s.IsActive)
            .GroupBy(s => s.VariantId).ToDictionary(g => g.Key, g => g.First());

        var activated = 0;
        var scheduled = 0;
        var appliedProducts = new HashSet<Guid>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            foreach (var (product, variant) in variants)
            {
                // Reuse the variant's recorded regular price when another offer is active, so
                // applying a second reusable discount never discounts an already discounted price.
                var hasActiveOffer = active.TryGetValue(variant.Id, out var activeSlot) && activeSlot.Label != "Original Price";
                var derivedRegularPrice = hasActiveOffer ? RecoverRegularPrice(activeSlot!) : null;
                decimal? originalPrice = originals.TryGetValue(variant.Id, out var foundOriginalPrice)
                    ? foundOriginalPrice
                    : null;
                var basePrice = hasActiveOffer
                    ? activeSlot!.RegularPriceSnapshot ?? product.MarketPrice ?? originalPrice ?? derivedRegularPrice ?? variant.PriceOverride ?? product.SellingPrice
                    : variant.PriceOverride.HasValue
                        ? originalPrice ?? variant.PriceOverride.Value
                        : product.MarketPrice ?? originalPrice ?? product.SellingPrice;
                if (basePrice <= 0) continue;
                appliedProducts.Add(product.Id);
                var price = Math.Round(basePrice * (100m - discount.Percent) / 100m, 2, MidpointRounding.AwayFromZero);
                var startDate = DateTime.SpecifyKind(discount.StartDate, DateTimeKind.Utc);
                var endDate = discount.EndDate.HasValue
                    ? DateTime.SpecifyKind(discount.EndDate.Value, DateTimeKind.Utc)
                    : (DateTime?)null;
                var slot = await priceSlots.CreateSlotAsync(variant.Id, new CreateSlotRequest(
                    $"{discount.Name} ({discount.Percent:0.##}%)", price, discount.Reason,
                    startDate, endDate, discount.Id, basePrice), userId);
                if (discount.StartDate <= DateTime.UtcNow)
                {
                    await priceSlots.ActivateSlotAsync(variant.Id, slot.Id, userId);
                    activated++;
                }
                else scheduled++;
            }
            if (activated + scheduled == 0)
                throw new InvalidOperationException("None of the selected products has a selling price to discount.");
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        var successfulVariants = activated + scheduled;
        return new(appliedProducts.Count, successfulVariants, activated, scheduled);
    }

    public async Task ArchiveAsync(Guid id, bool archived)
    {
        var discount = await db.ReusableDiscounts.FirstOrDefaultAsync(d => d.Id == id)
            ?? throw new KeyNotFoundException("Discount not found.");
        discount.IsArchived = archived;
        await db.SaveChangesAsync();
    }

    private static ReusableDiscountDto ToDto(ReusableDiscount discount, int applications, int active = 0) => new(
        discount.Id, discount.Name, discount.Percent, discount.Reason, discount.StartDate,
        discount.EndDate, discount.CreatedAt, discount.IsArchived, applications, active);

    private static (string Name, decimal Percent, string? Reason, DateTime StartDate, DateTime? EndDate) ValidateDefinition(
        string name, decimal percent, string? reason, DateTime startDate, DateTime? endDate)
    {
        name = name?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(name) || name.Length > 120)
            throw new ArgumentException("Enter a discount name of up to 120 characters.");
        if (percent is < 1 or > 90)
            throw new ArgumentException("Discount must be between 1% and 90%.");

        var start = startDate.Kind == DateTimeKind.Utc ? startDate : startDate.ToUniversalTime();
        DateTime? end = endDate.HasValue
            ? endDate.Value.Kind == DateTimeKind.Utc ? endDate.Value : endDate.Value.ToUniversalTime()
            : null;
        if (start.Date < DateTime.UtcNow.Date)
            throw new ArgumentException("Choose today or a future start date.");
        if (end.HasValue && end.Value <= start)
            throw new ArgumentException("End date must be after the start date.");

        return (name, percent, string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(), start, end);
    }

    private static decimal? RecoverRegularPrice(ExistingSlot activeSlot)
    {
        var match = System.Text.RegularExpressions.Regex.Match(activeSlot.Label, @"(\d+(?:\.\d+)?)%");
        if (!match.Success || !decimal.TryParse(match.Groups[1].Value,
                System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var percent)
            || percent <= 0 || percent >= 100) return null;
        return Math.Round(activeSlot.Price / (1m - percent / 100m), 2, MidpointRounding.AwayFromZero);
    }

    private sealed record ExistingSlot(Guid VariantId, string Label, decimal Price, decimal? RegularPriceSnapshot, bool IsActive, DateTime CreatedAt);
}
