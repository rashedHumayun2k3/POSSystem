using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Cartons;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class CartonService : ICartonService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _biz;

    public CartonService(AppDbContext db, IBusinessContext biz)
    {
        _db = db;
        _biz = biz;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public async Task<List<CartonSummaryDto>> ListAsync(Guid? tripId, string? status, Guid? variantId)
    {
        var q = _db.Cartons
            .AsNoTracking()
            .Include(c => c.Trip)
            .Include(c => c.Items)
            .AsQueryable();

        if (tripId.HasValue)   q = q.Where(c => c.TripId == tripId.Value);
        if (!string.IsNullOrEmpty(status)) q = q.Where(c => c.Status == status.ToUpper());

        if (variantId.HasValue)
            q = q.Where(c => c.Items.Any(i => i.VariantId == variantId.Value));

        var cartons = await q.OrderBy(c => c.CreatedAt).ToListAsync();
        return cartons.Select(ToSummary).ToList();
    }

    // ── Get detail ────────────────────────────────────────────────────────────

    public async Task<CartonDetailDto> GetAsync(Guid id)
    {
        var carton = await _db.Cartons
            .AsNoTracking()
            .Include(c => c.Trip)
            .Include(c => c.Items)
                .ThenInclude(i => i.Variant)
                    .ThenInclude(v => v.Product)
            .FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Carton not found.");

        return ToDetail(carton);
    }

    // ── Bulk create ───────────────────────────────────────────────────────────

    public async Task<List<CartonSummaryDto>> BulkCreateAsync(BulkCreateCartonsRequest request, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FindAsync(request.TripId)
            ?? throw new KeyNotFoundException("Trip not found.");

        // Determine carton numbers
        List<string> cartonNos;
        if (request.CustomNos is { Count: > 0 })
        {
            cartonNos = request.CustomNos;
        }
        else
        {
            // Find next sequence for this trip
            var existing = await _db.Cartons
                .Where(c => c.TripId == request.TripId)
                .Select(c => c.CartonNo)
                .ToListAsync();

            int nextSeq = existing.Count + 1;
            cartonNos = Enumerable.Range(nextSeq, request.Count)
                .Select(i => $"C-{i:D2}")
                .ToList();
        }

        var cartons = cartonNos.Select(no => new Carton
        {
            BusinessId = _biz.CurrentBusinessId,
            BranchId   = trip.BranchId,
            TripId     = request.TripId,
            CartonNo   = no,
            Status     = "SEALED",
            Location   = request.LocationPrefix,
            CreatedBy  = userId
        }).ToList();

        _db.Cartons.AddRange(cartons);
        await _db.SaveChangesAsync();

        // Reload with Trip for DTO
        var ids = cartons.Select(c => c.Id).ToList();
        var reloaded = await _db.Cartons
            .AsNoTracking()
            .Include(c => c.Trip)
            .Include(c => c.Items)
            .Where(c => ids.Contains(c.Id))
            .ToListAsync();

        return reloaded.Select(ToSummary).ToList();
    }

    // ── Update header ─────────────────────────────────────────────────────────

    public async Task<CartonDetailDto> UpdateAsync(Guid id, UpdateCartonRequest request, Guid userId)
    {
        var carton = await LoadWithItems(id);

        if (request.CartonNo is not null) carton.CartonNo = request.CartonNo.Trim();
        if (request.Location is not null) carton.Location = request.Location.Trim();
        if (request.Notes    is not null) carton.Notes    = request.Notes.Trim();
        carton.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetAsync(id);
    }

    // ── Open carton (enter contents) ──────────────────────────────────────────

    public async Task<CartonDetailDto> OpenAsync(Guid id, OpenCartonRequest request, Guid userId)
    {
        var carton = await LoadWithItems(id);

        if (carton.Status == "DONE")
            throw new InvalidOperationException("Carton is already done.");

        // Replace items
        _db.CartonItems.RemoveRange(carton.Items);

        var newItems = request.Items.Select(i => new CartonItem
        {
            CartonId     = carton.Id,
            VariantId    = i.VariantId,
            QtyInCarton  = i.QtyInCarton,
            QtyDamaged   = i.QtyDamaged,
            QtyLabeled   = 0,
            LabelPrice   = i.LabelPrice
        }).ToList();

        _db.CartonItems.AddRange(newItems);

        carton.Status   = "OPENED";
        carton.OpenedAt = carton.OpenedAt ?? DateTime.UtcNow;
        if (request.Location is not null) carton.Location = request.Location.Trim();
        if (request.Notes    is not null) carton.Notes    = request.Notes.Trim();
        carton.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetAsync(id);
    }

    // ── Record labeling ───────────────────────────────────────────────────────

    public async Task<CartonDetailDto> LabelItemAsync(Guid cartonId, Guid itemId, LabelCartonItemRequest request, Guid userId)
    {
        var carton = await LoadWithItems(cartonId);
        var item   = carton.Items.FirstOrDefault(i => i.Id == itemId)
            ?? throw new KeyNotFoundException("Carton item not found.");

        var maxRemaining = item.QtyInCarton - item.QtyDamaged - item.QtyLabeled;
        if (request.QtyNowLabeled > maxRemaining)
            throw new InvalidOperationException($"Cannot label more than remaining qty ({maxRemaining}).");

        item.QtyLabeled  += request.QtyNowLabeled;
        item.UpdatedAt    = DateTime.UtcNow;

        // Recalculate carton status
        carton.Status    = ComputeCartonStatus(carton.Items);
        carton.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await GetAsync(cartonId);
    }

    // ── Delete (SEALED only) ──────────────────────────────────────────────────

    public async Task DeleteAsync(Guid id, Guid userId)
    {
        var carton = await _db.Cartons.FindAsync(id)
            ?? throw new KeyNotFoundException("Carton not found.");

        if (carton.Status != "SEALED")
            throw new InvalidOperationException("Only SEALED cartons can be deleted.");

        carton.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    // ── Reports ───────────────────────────────────────────────────────────────

    public async Task<StoreroomSummaryDto> GetSummaryAsync()
    {
        var cartons = await _db.Cartons.AsNoTracking().Include(c => c.Items).ToListAsync();

        return new StoreroomSummaryDto(
            TotalCartons:       cartons.Count,
            Sealed:             cartons.Count(c => c.Status == "SEALED"),
            Opened:             cartons.Count(c => c.Status == "OPENED"),
            Partial:            cartons.Count(c => c.Status == "PARTIAL"),
            Done:               cartons.Count(c => c.Status == "DONE"),
            TotalUnitsInCartons: cartons.SelectMany(c => c.Items).Sum(i => i.QtyInCarton),
            TotalLabeled:       cartons.SelectMany(c => c.Items).Sum(i => i.QtyLabeled),
            TotalDamaged:       cartons.SelectMany(c => c.Items).Sum(i => i.QtyDamaged)
        );
    }

    public async Task<List<LocationLookupItemDto>> LocationLookupAsync(Guid variantId)
    {
        var items = await _db.CartonItems
            .AsNoTracking()
            .Include(i => i.Carton).ThenInclude(c => c.Trip)
            .Where(i => i.VariantId == variantId && i.Carton.Status != "DONE" && i.QtyDamaged < i.QtyInCarton)
            .OrderBy(i => i.Carton.Status)
            .ToListAsync();

        return items.Select(i => new LocationLookupItemDto(
            CartonId:    i.CartonId,
            CartonNo:    i.Carton.CartonNo,
            TripId:      i.Carton.TripId,
            TripNo:      i.Carton.Trip.TripNo,
            Location:    i.Carton.Location,
            Status:      i.Carton.Status,
            QtyInCarton: i.QtyInCarton,
            QtyLabeled:  i.QtyLabeled,
            QtyDamaged:  i.QtyDamaged
        )).ToList();
    }

    public async Task<List<DamagedItemDto>> GetDamagedAsync()
    {
        var items = await _db.CartonItems
            .AsNoTracking()
            .Include(i => i.Carton).ThenInclude(c => c.Trip)
            .Include(i => i.Variant).ThenInclude(v => v.Product)
            .Where(i => i.QtyDamaged > 0)
            .OrderByDescending(i => i.Carton.OpenedAt)
            .ToListAsync();

        return items.Select(i => new DamagedItemDto(
            CartonId:     i.CartonId,
            CartonNo:     i.Carton.CartonNo,
            TripId:       i.Carton.TripId,
            TripNo:       i.Carton.Trip.TripNo,
            OpenedAt:     i.Carton.OpenedAt,
            VariantId:    i.VariantId,
            ProductName:  i.Variant.Product.Name,
            VariantSku:   i.Variant.Sku,
            VariantValues: i.Variant.VariantValuesJson,
            QtyDamaged:   i.QtyDamaged
        )).ToList();
    }

    public async Task<List<TripWithCartonsDto>> GetTripsWithCartonsAsync()
    {
        var cartons = await _db.Cartons
            .AsNoTracking()
            .Include(c => c.Trip)
            .ToListAsync();

        return cartons
            .GroupBy(c => c.TripId)
            .Select(g =>
            {
                var first = g.First();
                return new TripWithCartonsDto(
                    g.Key,
                    first.Trip?.TripNo ?? "",
                    first.Trip?.Status ?? "",
                    first.Trip?.CreatedAt ?? DateTime.UtcNow,
                    g.Count(),
                    g.Count(c => c.Status == "SEALED"),
                    g.Count(c => c.Status == "DONE")
                );
            })
            .OrderByDescending(t => t.CreatedAt)
            .ToList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<Carton> LoadWithItems(Guid id)
        => await _db.Cartons.Include(c => c.Items).FirstOrDefaultAsync(c => c.Id == id)
           ?? throw new KeyNotFoundException("Carton not found.");

    private static string ComputeCartonStatus(ICollection<CartonItem> items)
    {
        if (items.Count == 0) return "OPENED";

        bool allDone = items.All(i => i.QtyLabeled + i.QtyDamaged >= i.QtyInCarton);
        if (allDone) return "DONE";

        bool anyLabeled = items.Any(i => i.QtyLabeled > 0);
        return anyLabeled ? "PARTIAL" : "OPENED";
    }

    private static CartonSummaryDto ToSummary(Carton c) => new(
        Id:               c.Id,
        CartonNo:         c.CartonNo,
        TripId:           c.TripId,
        TripNo:           c.Trip?.TripNo ?? "",
        Status:           c.Status,
        Location:         c.Location,
        Notes:            c.Notes,
        CreatedAt:        c.CreatedAt,
        OpenedAt:         c.OpenedAt,
        ItemCount:        c.Items.Count,
        TotalQtyInCarton: c.Items.Sum(i => i.QtyInCarton),
        TotalLabeled:     c.Items.Sum(i => i.QtyLabeled),
        TotalDamaged:     c.Items.Sum(i => i.QtyDamaged)
    );

    private static CartonDetailDto ToDetail(Carton c) => new(
        Id:       c.Id,
        CartonNo: c.CartonNo,
        TripId:   c.TripId,
        TripNo:   c.Trip?.TripNo ?? "",
        Status:   c.Status,
        Location: c.Location,
        Notes:    c.Notes,
        CreatedAt: c.CreatedAt,
        OpenedAt:  c.OpenedAt,
        Items: c.Items.Select(i => new CartonItemDto(
            Id:            i.Id,
            VariantId:     i.VariantId,
            VariantSku:    i.Variant?.Sku ?? "",
            ProductName:   i.Variant?.Product?.Name ?? "",
            VariantValues: i.Variant?.VariantValuesJson ?? "{}",
            Barcode:       i.Variant?.Barcode,
            QtyInCarton:   i.QtyInCarton,
            QtyLabeled:    i.QtyLabeled,
            QtyDamaged:    i.QtyDamaged,
            LabelPrice:    i.LabelPrice,
            QtyRemaining:  Math.Max(0, i.QtyInCarton - i.QtyLabeled - i.QtyDamaged)
        )).ToList()
    );
}
