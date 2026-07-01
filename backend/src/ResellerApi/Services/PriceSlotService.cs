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

        var slot = new PriceSlot
        {
            BusinessId = _business.CurrentBusinessId,
            VariantId = variantId,
            Label = request.Label.Trim(),
            Price = request.NewPrice,
            Reason = request.Reason?.Trim(),
            IsActive = false,
            CreatedBy = userId,
        };
        _db.PriceSlots.Add(slot);

        // Auto-activate if this is the first slot for this variant
        var hasExistingSlot = await _db.PriceSlots
            .AnyAsync(s => s.VariantId == variantId);

        if (!hasExistingSlot)
        {
            slot.IsActive = true;
            ApplyPriceToVariant(variant, slot.Price);
            _db.PriceActivationLogs.Add(new PriceActivationLog
            {
                BusinessId = _business.CurrentBusinessId,
                VariantId = variantId,
                SlotId = slot.Id,
                PriceSnapshot = slot.Price,
                LabelSnapshot = slot.Label,
                ActivatedAt = DateTime.UtcNow,
                DeactivatedAt = null,
                ActivatedBy = userId,
            });
        }

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

        var now = DateTime.UtcNow;

        // Close the current active log entry
        var openLog = await _db.PriceActivationLogs
            .FirstOrDefaultAsync(l => l.VariantId == variantId && l.DeactivatedAt == null);
        if (openLog != null)
            openLog.DeactivatedAt = now;

        // Deactivate previous active slot
        var currentActive = await _db.PriceSlots
            .FirstOrDefaultAsync(s => s.VariantId == variantId && s.IsActive);
        if (currentActive != null)
            currentActive.IsActive = false;

        // Activate target slot
        targetSlot.IsActive = true;
        ApplyPriceToVariant(variant, targetSlot.Price);

        // Open new log entry
        _db.PriceActivationLogs.Add(new PriceActivationLog
        {
            BusinessId = _business.CurrentBusinessId,
            VariantId = variantId,
            SlotId = slotId,
            PriceSnapshot = targetSlot.Price,
            LabelSnapshot = targetSlot.Label,
            ActivatedAt = now,
            DeactivatedAt = null,
            ActivatedBy = userId,
        });

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
        userName ?? s.CreatedByUser?.Name ?? "Unknown"
    );
}
