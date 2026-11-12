using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class StockAdjustmentService : IStockAdjustmentService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public StockAdjustmentService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
    }

    private static readonly HashSet<string> ValidReasons =
        new(["EXISTING_STOCK", "DAMAGED", "LOST_THEFT", "RECOUNT", "FOUND_EXTRA", "OTHER"], StringComparer.OrdinalIgnoreCase);

    public async Task<List<StockAdjustmentDto>> GetHistoryAsync(Guid variantId)
    {
        var rows = await _db.StockMovements
            .AsNoTracking()
            .Include(m => m.User)
            .Where(m => m.VariantId == variantId
                && (m.MovementType == "ADJUSTMENT" || m.MovementType == "PURCHASE_IN" || m.MovementType == "DAMAGE_IN"))
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();

        // Purchase receipts are shown next to manual adjustments so the owner can see where stock came from.
        return rows.Select(m => new StockAdjustmentDto(
            m.Id,
            m.MovementType switch { "PURCHASE_IN" => "PURCHASE", "DAMAGE_IN" => "DAMAGED_IN", _ => m.Reason ?? "OTHER" },
            m.Qty, m.Note, m.User.Name, m.CreatedAt
        )).ToList();
    }

    // Movements that change sellable stock (OnHand). COMMIT/RELEASE only reserve stock for orders.
    private static readonly string[] StockTypes = ["ADJUSTMENT", "PURCHASE_IN", "SALE_OUT", "RETURN_IN"];
    // Damaged units live in a separate count, so these never change sellable stock.
    private static readonly string[] DamageTypes = ["DAMAGE_IN", "DAMAGE_OUT", "DAMAGE_WRITEOFF"];

    public async Task<StockHistoryDto> GetTimelineAsync(Guid variantId)
    {
        var branchId = _business.CurrentBranchId;
        var inventories = await _db.BranchVariantInventories.AsNoTracking()
            .Where(i => i.VariantId == variantId && (branchId == null || i.BranchId == branchId))
            .ToListAsync();
        var onHand = inventories.Sum(i => i.OnHand);

        var rows = await _db.StockMovements.AsNoTracking()
            .Where(m => m.VariantId == variantId && (branchId == null || m.BranchId == branchId)
                && (StockTypes.Contains(m.MovementType) || DamageTypes.Contains(m.MovementType)))
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new { m.Id, m.MovementType, m.Reason, m.Qty, m.Note, UserName = m.User.Name, m.CreatedAt, m.ReferenceType, m.ReferenceId })
            .ToListAsync();

        // Resolve the source document (PO or order) for each movement.
        var ids = rows.Where(r => r.ReferenceId != null).Select(r => r.ReferenceId!.Value).Distinct().ToList();
        var sessionTrips = await _db.PurchaseReceiveSessions.AsNoTracking().Where(s => ids.Contains(s.Id)).Select(s => new { s.Id, s.TripId }).ToDictionaryAsync(s => s.Id, s => s.TripId);
        var itemTrips = await _db.PurchaseItems.AsNoTracking().Where(i => ids.Contains(i.Id)).Select(i => new { i.Id, i.TripId }).ToDictionaryAsync(i => i.Id, i => i.TripId);
        var tripIds = sessionTrips.Values.Concat(itemTrips.Values).Distinct().ToList();
        var trips = await _db.PurchaseTrips.AsNoTracking().Where(t => tripIds.Contains(t.Id)).Select(t => new { t.Id, t.Note, t.TripNo }).ToDictionaryAsync(t => t.Id);
        var orders = await _db.Orders.AsNoTracking().Where(o => ids.Contains(o.Id)).Select(o => new { o.Id, o.OrderNo }).ToDictionaryAsync(o => o.Id);

        var balance = onHand;
        var entries = new List<StockHistoryEntryDto>();
        foreach (var r in rows)
        {
            var affects = StockTypes.Contains(r.MovementType);
            // Damaged arrivals add to the damaged count, not to sellable stock: show them as a removal.
            var qty = r.MovementType == "DAMAGE_IN" ? -Math.Abs(r.Qty) : affects ? r.Qty : -Math.Abs(r.Qty);
            string? refKind = null, refNo = null; Guid? refId = null;
            if (r.ReferenceId is Guid rid)
            {
                Guid? tripId = sessionTrips.TryGetValue(rid, out var st) ? st : itemTrips.TryGetValue(rid, out var it) ? it : null;
                if (tripId is Guid tid && trips.TryGetValue(tid, out var trip)) { refKind = "PO"; refId = tid; refNo = string.IsNullOrWhiteSpace(trip.Note) ? trip.TripNo : trip.Note.Trim(); }
                else if (orders.TryGetValue(rid, out var order)) { refKind = "ORDER"; refId = order.Id; refNo = order.OrderNo; }
            }
            var reason = r.MovementType switch
            {
                "PURCHASE_IN" => "PURCHASE",
                "SALE_OUT" => "SALE",
                "RETURN_IN" => "RETURN",
                "DAMAGE_IN" => "DAMAGED_ARRIVAL",
                "DAMAGE_OUT" => "DAMAGED_RETURNED",
                "DAMAGE_WRITEOFF" => "DAMAGED_WRITEOFF",
                _ => r.ReferenceType == "ExistingStockCost" ? "EXISTING_STOCK" : r.ReferenceType == "VariantSplit" ? "VARIANT_SPLIT" : r.Reason ?? "OTHER"
            };
            entries.Add(new StockHistoryEntryDto(r.Id, r.MovementType, reason, qty, affects, balance, r.Note, r.UserName, r.CreatedAt,
                refKind, refId, refNo, affects ? null : "DAMAGED"));
            if (affects) balance -= r.Qty;
        }

        return new StockHistoryDto(onHand, inventories.Sum(i => i.Committed), inventories.Sum(i => i.Damaged), balance, entries);
    }

    public async Task<StockAdjustmentDto> AdjustAsync(Guid variantId, AdjustStockRequest request, Guid userId)
    {
        var variant = await _db.ProductVariants.Include(v => v.Product).FirstOrDefaultAsync(v => v.Id == variantId)
            ?? throw new KeyNotFoundException("Variant not found.");
        ProductService.EnsureWholeQuantity(variant.Product.UnitCode, request.Value);

        var reason = request.Reason.ToUpper();
        if (!ValidReasons.Contains(reason))
            throw new ArgumentException($"Invalid reason: {reason}");

        var mode = request.Mode.ToUpper();
        if (mode != "SET" && mode != "DELTA")
            throw new ArgumentException($"Invalid mode: {mode}");

        var branchId = await ResolveBranchIdAsync(request.BranchId);

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var inv = await _db.BranchVariantInventories
                .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", branchId, variantId)
                .FirstOrDefaultAsync();

            var currentOnHand = inv?.OnHand ?? 0;
            var delta = mode == "SET" ? request.Value - currentOnHand : request.Value;

            if (currentOnHand + delta < 0)
                throw new InvalidOperationException("This adjustment would result in negative stock.");

            if (inv == null)
            {
                inv = new BranchVariantInventory { BranchId = branchId, VariantId = variantId, OnHand = 0, Committed = 0, Damaged = 0 };
                _db.BranchVariantInventories.Add(inv);
            }
            inv.OnHand += delta;

            var movement = new StockMovement
            {
                BusinessId = _business.CurrentBusinessId,
                BranchId = branchId,
                VariantId = variantId,
                MovementType = "ADJUSTMENT",
                Qty = delta,
                ReferenceType = "StockAdjustment",
                UserId = userId,
                Reason = reason,
                Note = request.Note
            };
            _db.StockMovements.Add(movement);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "StockMovement", movement.Id);

            var user = await _db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
            return new StockAdjustmentDto(movement.Id, reason, delta, movement.Note, user.Name, movement.CreatedAt);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    private async Task<Guid> ResolveBranchIdAsync(Guid? requestedBranchId)
    {
        if (requestedBranchId.HasValue)
        {
            var exists = await _db.Branches.AnyAsync(b => b.Id == requestedBranchId.Value && b.IsActive);
            if (!exists)
                throw new KeyNotFoundException("Branch not found or inactive.");
            return requestedBranchId.Value;
        }

        if (_business.CurrentBranchId.HasValue)
            return _business.CurrentBranchId.Value;

        var activeBranches = await _db.Branches.Where(b => b.IsActive).Select(b => b.Id).ToListAsync();
        if (activeBranches.Count == 1)
            return activeBranches[0];
        if (activeBranches.Count == 0)
            throw new InvalidOperationException("No active branch exists for this business.");
        throw new InvalidOperationException("This business has multiple branches; a branch must be selected.");
    }
}
