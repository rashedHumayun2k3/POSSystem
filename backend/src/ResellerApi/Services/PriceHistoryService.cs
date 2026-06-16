using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PriceHistoryService : IPriceHistoryService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;

    public PriceHistoryService(AppDbContext db, IBusinessContext business)
    {
        _db = db;
        _business = business;
    }

    public async Task<List<PriceHistoryDto>> GetHistoryAsync(Guid variantId)
    {
        var rows = await _db.PriceHistories
            .AsNoTracking()
            .Where(ph => ph.VariantId == variantId)
            .Include(ph => ph.ChangedByUser)
            .OrderByDescending(ph => ph.EffectiveFrom)
            .ToListAsync();

        return rows.Select(ph => MapDto(ph)).ToList();
    }

    public async Task<PriceHistoryDto> ChangePriceAsync(ChangePriceRequest request, Guid userId)
    {
        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == request.VariantId)
            ?? throw new KeyNotFoundException("Variant not found.");

        var currentPrice = variant.PriceOverride ?? variant.Product.SellingPrice;
        var effectiveFrom = request.EffectiveFrom?.ToUniversalTime() ?? DateTime.UtcNow;
        var isImmediate = effectiveFrom <= DateTime.UtcNow;

        var history = new PriceHistory
        {
            BusinessId = _business.CurrentBusinessId,
            VariantId = request.VariantId,
            OldPrice = currentPrice,
            NewPrice = request.NewPrice,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = request.RevertAt?.ToUniversalTime(),
            ChangedBy = userId,
            Reason = request.Reason,
            IsScheduled = !isImmediate,
            IsRevert = false,
            IsApplied = isImmediate
        };
        _db.PriceHistories.Add(history);

        // Create the auto-revert row (always scheduled)
        if (request.RevertAt.HasValue)
        {
            _db.PriceHistories.Add(new PriceHistory
            {
                BusinessId = _business.CurrentBusinessId,
                VariantId = request.VariantId,
                OldPrice = request.NewPrice,
                NewPrice = currentPrice,
                EffectiveFrom = request.RevertAt.Value.ToUniversalTime(),
                ChangedBy = userId,
                Reason = $"Auto-revert: {request.Reason}",
                IsScheduled = true,
                IsRevert = true,
                IsApplied = false
            });
        }

        // Apply immediately if effective now
        if (isImmediate)
        {
            if (variant.IsDefault && variant.PriceOverride == null)
                variant.Product.SellingPrice = request.NewPrice;
            else
                variant.PriceOverride = request.NewPrice;
        }

        await _db.SaveChangesAsync();

        var user = await _db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        return MapDto(history, user.Name);
    }

    // Called by Hangfire — ignores business filter to process all tenants
    public async Task ApplyScheduledPriceChangesAsync()
    {
        var now = DateTime.UtcNow;
        var due = await _db.PriceHistories
            .IgnoreQueryFilters()
            .Include(ph => ph.Variant)
            .ThenInclude(v => v.Product)
            .Where(ph => ph.IsScheduled && !ph.IsApplied && ph.EffectiveFrom <= now)
            .ToListAsync();

        foreach (var ph in due)
        {
            if (ph.Variant.IsDefault && ph.Variant.PriceOverride == null)
                ph.Variant.Product.SellingPrice = ph.NewPrice;
            else
                ph.Variant.PriceOverride = ph.NewPrice;

            ph.IsApplied = true;
        }

        if (due.Count > 0)
            await _db.SaveChangesAsync();
    }

    private static PriceHistoryDto MapDto(PriceHistory ph, string? userName = null) => new(
        ph.Id,
        ph.OldPrice,
        ph.NewPrice,
        ph.EffectiveFrom,
        ph.EffectiveTo,
        userName ?? ph.ChangedByUser?.Name ?? "Unknown",
        ph.Reason,
        ph.IsScheduled,
        ph.IsRevert
    );
}
