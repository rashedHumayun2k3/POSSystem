using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PriceSlotService : IPriceSlotService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;

    public PriceSlotService(AppDbContext db, IBusinessContext business)
    {
        _db = db;
        _business = business;
    }

    public async Task<List<PriceSlotDto>> GetSlotsAsync(Guid variantId)
    {
        // Reconcile scheduled Offers before reading (same reason as ProductService.GetAsync) —
        // without this, this endpoint could show a slot as "active" that a different read path
        // (e.g. the product detail fetch) already reconciled away, since nothing else tells this
        // query that the schedule moved on.
        await EnsureScheduledStateAsync(variantId);

        var slots = await _db.PriceSlots
            .AsNoTracking()
            .Where(s => s.VariantId == variantId)
            .Include(s => s.CreatedByUser)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        return slots.Select(s => MapSlotDto(s)).ToList();
    }

    public async Task<PriceSlotDto> CreateSlotAsync(Guid variantId, CreateSlotRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.Label))
            throw new ArgumentException("Label is required.");
        if (request.NewPrice <= 0)
            throw new ArgumentException("Price must be greater than zero.");

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId)
            ?? throw new KeyNotFoundException("Variant not found.");

        var now = DateTime.UtcNow;
        var startDate = request.StartDate?.ToUniversalTime() ?? now;

        var slot = new PriceSlot
        {
            BusinessId = _business.CurrentBusinessId,
            VariantId = variantId,
            Label = request.Label.Trim(),
            Price = request.NewPrice,
            Reason = request.Reason?.Trim(),
            IsActive = false,
            CreatedBy = userId,
            StartDate = startDate,
            EndDate = request.EndDate?.ToUniversalTime(),
        };
        _db.PriceSlots.Add(slot);

        // Auto-activate if this is the first slot ever for this variant AND it's actually due to
        // start now (a future-dated first slot stays pending — EnsureScheduledStateAsync picks it
        // up once its StartDate arrives, same as any other scheduled slot).
        var hasExistingSlot = await _db.PriceSlots.AnyAsync(s => s.VariantId == variantId);
        if (!hasExistingSlot && startDate <= now)
            await ActivateSlotCoreAsync(variant, slot, userId, now);

        await _db.SaveChangesAsync();

        var user = await _db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        return MapSlotDto(slot, user.Name);
    }

    public async Task ActivateSlotAsync(Guid variantId, Guid slotId, Guid userId)
    {
        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId)
            ?? throw new KeyNotFoundException("Variant not found.");

        var targetSlot = await _db.PriceSlots
            .FirstOrDefaultAsync(s => s.Id == slotId && s.VariantId == variantId)
            ?? throw new KeyNotFoundException("Price slot not found.");

        if (targetSlot.IsActive)
            return; // already active, no-op

        await ActivateSlotCoreAsync(variant, targetSlot, userId, DateTime.UtcNow);
        await _db.SaveChangesAsync();
    }

    // Reconciles what should be active against each slot's StartDate/EndDate window. Called from
    // product read paths (ProductService.GetAsync, barcode lookup, etc.) instead of a background
    // job — so a scheduled offer takes effect the next time anyone actually looks at or scans this
    // product, which for a small business covers what matters most (an actual sale) without needing
    // a recurring job to sweep every product on a timer.
    public async Task EnsureScheduledStateAsync(Guid variantId)
    {
        var now = DateTime.UtcNow;

        var slots = await _db.PriceSlots
            .Where(s => s.VariantId == variantId)
            .ToListAsync();
        if (slots.Count == 0)
            return; // nothing scheduled, nothing to reconcile

        var currentActive = slots.FirstOrDefault(s => s.IsActive);

        // If the currently active slot's own window still covers now, leave it alone — manual
        // activation (tapping "Apply") always wins over the schedule as long as it hasn't actually
        // expired. Without this check, every existing offer (all created with a past StartDate,
        // long before scheduling existed) is simultaneously "due", so re-running the "latest
        // StartDate wins" pick on every read would immediately override any manual Apply back to
        // whichever offer happens to be newest — silently undoing the tap before it's even visible.
        var currentStillValid = currentActive != null
            && currentActive.StartDate <= now
            && (currentActive.EndDate == null || currentActive.EndDate >= now);
        if (currentStillValid)
            return;

        // Nothing valid is currently active (first-ever read, or the active slot just expired) —
        // pick the best candidate whose window covers now, preferring the one that started most
        // recently if more than one qualifies.
        var dueSlot = slots
            .Where(s => s.StartDate <= now && (s.EndDate == null || s.EndDate >= now))
            .OrderByDescending(s => s.StartDate)
            .FirstOrDefault();

        // This runs from GET endpoints that the frontend fires in parallel (product detail +
        // Offers list load at the same time) — if two concurrent requests both decide the same
        // reconciliation is needed, whichever saves second hits a rowversion mismatch. That's an
        // expected, harmless outcome here (the other request already reached the correct state),
        // not a real conflict for the caller to see — a GET request should never surface a 409.
        try
        {
            if (dueSlot != null)
            {
                var variant = await _db.ProductVariants
                    .Include(v => v.Product)
                    .FirstOrDefaultAsync(v => v.Id == variantId)
                    ?? throw new KeyNotFoundException("Variant not found.");
                // Attributed to whoever created this slot — there's no acting user for a lazy
                // read-triggered activation (could be an anonymous ClientPage visitor), but the
                // person who scheduled it is a real, meaningful "on whose behalf" for the log.
                await ActivateSlotCoreAsync(variant, dueSlot, dueSlot.CreatedBy, now);
                await _db.SaveChangesAsync();
                return;
            }

            // Nothing currently qualifies. Only act if the active slot has genuinely expired (has
            // an EndDate that's passed) — "no active offer" isn't a state PriceSlot supports, so
            // reverting means recording a real slot for it too (GTR-7), same as manual "Remove Offer".
            if (currentActive != null && currentActive.EndDate != null && currentActive.EndDate < now)
            {
                var variant = await _db.ProductVariants
                    .Include(v => v.Product)
                    .FirstOrDefaultAsync(v => v.Id == variantId)
                    ?? throw new KeyNotFoundException("Variant not found.");

                // No marketPrice set means there's no well-defined "original" price to revert to —
                // leave the expired offer's price in place rather than reverting to something arbitrary.
                if (variant.Product.MarketPrice is not { } referencePrice)
                    return;

                var revertSlot = new PriceSlot
                {
                    BusinessId = _business.CurrentBusinessId,
                    VariantId = variantId,
                    Label = "Original Price",
                    Price = referencePrice,
                    Reason = null,
                    IsActive = false,
                    CreatedBy = currentActive.CreatedBy,
                    StartDate = now,
                    EndDate = null,
                };
                _db.PriceSlots.Add(revertSlot);
                await ActivateSlotCoreAsync(variant, revertSlot, currentActive.CreatedBy, now);
                await _db.SaveChangesAsync();
            }
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another concurrent request already reconciled this variant — nothing left to do.
        }
    }

    public async Task DeleteSlotAsync(Guid variantId, Guid slotId, Guid userId)
    {
        var slot = await _db.PriceSlots
            .FirstOrDefaultAsync(s => s.Id == slotId && s.VariantId == variantId)
            ?? throw new KeyNotFoundException("Price slot not found.");

        if (slot.IsActive)
            throw new InvalidOperationException("Cannot delete the currently active offer — unapply it first.");

        slot.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<List<PriceActivationLogDto>> GetActivationHistoryAsync(Guid variantId)
    {
        var logs = await _db.PriceActivationLogs
            .AsNoTracking()
            .Where(l => l.VariantId == variantId)
            .Include(l => l.ActivatedByUser)
            .OrderByDescending(l => l.ActivatedAt)
            .ToListAsync();

        return logs.Select(l => new PriceActivationLogDto(
            l.Id,
            l.SlotId,
            l.LabelSnapshot,
            l.PriceSnapshot,
            l.ActivatedAt,
            l.DeactivatedAt,
            l.ActivatedByUser?.Name ?? "Unknown"
        )).ToList();
    }

    // Shared by ActivateSlotAsync, CreateSlotAsync (first-ever slot), and EnsureScheduledStateAsync
    // — deactivates whatever's currently active, activates targetSlot, applies its price to the
    // variant/product, and opens a fresh PriceActivationLog entry. Caller is responsible for
    // SaveChangesAsync.
    private async Task ActivateSlotCoreAsync(ProductVariant variant, PriceSlot targetSlot, Guid userId, DateTime now)
    {
        var openLog = await _db.PriceActivationLogs
            .FirstOrDefaultAsync(l => l.VariantId == variant.Id && l.DeactivatedAt == null);
        if (openLog != null)
            openLog.DeactivatedAt = now;

        var currentActive = await _db.PriceSlots
            .FirstOrDefaultAsync(s => s.VariantId == variant.Id && s.IsActive);
        if (currentActive != null)
            currentActive.IsActive = false;

        targetSlot.IsActive = true;
        ApplyPriceToVariant(variant, targetSlot.Price);

        _db.PriceActivationLogs.Add(new PriceActivationLog
        {
            BusinessId = _business.CurrentBusinessId,
            VariantId = variant.Id,
            SlotId = targetSlot.Id,
            PriceSnapshot = targetSlot.Price,
            LabelSnapshot = targetSlot.Label,
            ActivatedAt = now,
            DeactivatedAt = null,
            ActivatedBy = userId,
        });
    }

    private static void ApplyPriceToVariant(ProductVariant variant, decimal price)
    {
        if (variant.IsDefault && variant.PriceOverride == null)
            variant.Product.SellingPrice = price;
        else
            variant.PriceOverride = price;
    }

    private static PriceSlotDto MapSlotDto(PriceSlot s, string? userName = null) => new(
        s.Id,
        s.Label,
        s.Price,
        s.Reason,
        s.IsActive,
        s.CreatedAt,
        userName ?? s.CreatedByUser?.Name ?? "Unknown",
        s.StartDate,
        s.EndDate
    );
}
