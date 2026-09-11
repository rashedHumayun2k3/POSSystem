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
            .Where(m => m.VariantId == variantId && m.MovementType == "ADJUSTMENT")
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();

        return rows.Select(m => new StockAdjustmentDto(
            m.Id, m.Reason ?? "OTHER", m.Qty, m.Note, m.User.Name, m.CreatedAt
        )).ToList();
    }

    public async Task<StockAdjustmentDto> AdjustAsync(Guid variantId, AdjustStockRequest request, Guid userId)
    {
        var variant = await _db.ProductVariants.FirstOrDefaultAsync(v => v.Id == variantId)
            ?? throw new KeyNotFoundException("Variant not found.");

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
