using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.SupplierReturns;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class SupplierReturnService : ISupplierReturnService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public SupplierReturnService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
    }

    private static readonly HashSet<string> ValidResolutionTypes =
        new(["REFUND", "REPLACEMENT", "CREDIT_NOTE", "WRITE_OFF"], StringComparer.OrdinalIgnoreCase);

    // ── Create ────────────────────────────────────────────────────────────────

    public async Task<SupplierReturnDetailDto> CreateAsync(CreateSupplierReturnRequest request, Guid userId)
    {
        var supplierExists = await _db.Suppliers.AnyAsync(s => s.Id == request.SupplierId);
        if (!supplierExists)
            throw new KeyNotFoundException("Supplier not found.");

        if (request.TripId.HasValue)
        {
            var tripExists = await _db.PurchaseTrips.AnyAsync(t => t.Id == request.TripId.Value);
            if (!tripExists)
                throw new KeyNotFoundException("Purchase trip not found.");
        }

        var branchId = await ResolveBranchIdAsync(request.BranchId);

        var ret = new SupplierReturn
        {
            BusinessId = _business.CurrentBusinessId,
            BranchId = branchId,
            SupplierReturnNo = await GenerateReturnNoAsync(),
            SupplierId = request.SupplierId,
            TripId = request.TripId,
            Status = "DRAFT",
            Note = request.Note,
            CreatedBy = userId
        };
        _db.SupplierReturns.Add(ret);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "SupplierReturn", ret.Id);
        return await GetAsync(ret.Id);
    }

    // ── List / Get ────────────────────────────────────────────────────────────

    public async Task<List<SupplierReturnListDto>> ListAsync(string? status, Guid? supplierId)
    {
        var q = _db.SupplierReturns
            .AsNoTracking()
            .Include(r => r.Supplier)
            .Include(r => r.Trip)
            .Include(r => r.Items)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(r => r.Status == status.ToUpper());
        if (supplierId.HasValue)
            q = q.Where(r => r.SupplierId == supplierId.Value);

        var returns = await q.OrderByDescending(r => r.CreatedAt).ToListAsync();

        return returns.Select(r => new SupplierReturnListDto(
            r.Id, r.SupplierReturnNo, r.SupplierId, r.Supplier.Name,
            r.TripId, r.Trip?.TripNo,
            r.Status,
            r.Items.Count(i => i.DeletedAt == null),
            r.Items.Where(i => i.DeletedAt == null).Sum(i => i.QtyReturned),
            r.Items.Where(i => i.DeletedAt == null).Sum(i => i.QtyReturned * i.UnitCost),
            r.CreatedAt
        )).ToList();
    }

    public async Task<SupplierReturnDetailDto> GetAsync(Guid id)
    {
        var ret = await _db.SupplierReturns
            .AsNoTracking()
            .Include(r => r.Supplier)
            .Include(r => r.Trip)
            .Include(r => r.CreatedByUser)
            .Include(r => r.ResolvedByUser)
            .Include(r => r.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product)
            .Include(r => r.Items).ThenInclude(i => i.ReplacementTrip)
            .FirstOrDefaultAsync(r => r.Id == id)
            ?? throw new KeyNotFoundException("Supplier return not found.");

        return MapDetail(ret);
    }

    public async Task<List<DamagedStockItemDto>> ListDamagedStockAsync(Guid? branchId, string? search)
    {
        var resolvedBranchId = await ResolveBranchIdAsync(branchId);

        var committedByVariant = (await _db.SupplierReturnItems.AsNoTracking()
            .Where(i => i.DeletedAt == null
                && (i.Return.Status == "DRAFT" || i.Return.Status == "SUBMITTED")
                && i.Return.BranchId == resolvedBranchId)
            .GroupBy(i => i.VariantId)
            .Select(g => new { VariantId = g.Key, Qty = g.Sum(x => x.QtyReturned) })
            .ToListAsync())
            .ToDictionary(x => x.VariantId, x => x.Qty);

        var q = _db.BranchVariantInventories.AsNoTracking()
            .Include(i => i.Variant).ThenInclude(v => v.Product)
            .Where(i => i.BranchId == resolvedBranchId && i.Damaged > 0)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(i => i.Variant.Sku.Contains(s) || i.Variant.Product.Name.Contains(s));
        }

        var rows = await q.ToListAsync();

        return rows
            .Select(i => new DamagedStockItemDto(
                i.VariantId, i.Variant.Sku, i.Variant.Product.Name, i.Variant.Product.UnitCode,
                i.Damaged - committedByVariant.GetValueOrDefault(i.VariantId, 0),
                i.Variant.AvgLandedCost))
            .Where(d => d.DamagedQty > 0)
            .OrderBy(d => d.ProductName)
            .ToList();
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public async Task<SupplierReturnDetailDto> AddItemAsync(Guid returnId, AddSupplierReturnItemRequest request)
    {
        var ret = await RequireDraftReturnAsync(returnId);
        await ValidateItemRequestAsync(ret, request.VariantId, request.QtyReturned, request.UnitCost,
            request.ResolutionType, request.ReplacementTripId, excludeItemId: null);

        _db.SupplierReturnItems.Add(new SupplierReturnItem
        {
            ReturnId = ret.Id,
            VariantId = request.VariantId,
            QtyReturned = request.QtyReturned,
            UnitCost = request.UnitCost,
            ResolutionType = request.ResolutionType.ToUpper(),
            ResolutionAmount = request.ResolutionAmount,
            ReplacementTripId = request.ReplacementTripId,
            Note = request.Note
        });
        await _db.SaveChangesAsync();

        return await GetAsync(returnId);
    }

    public async Task<SupplierReturnDetailDto> UpdateItemAsync(Guid returnId, Guid itemId, UpdateSupplierReturnItemRequest request)
    {
        var ret = await RequireDraftReturnAsync(returnId);
        var item = await _db.SupplierReturnItems.FirstOrDefaultAsync(i => i.Id == itemId && i.ReturnId == returnId)
            ?? throw new KeyNotFoundException("Return item not found.");

        await ValidateItemRequestAsync(ret, item.VariantId, request.QtyReturned, request.UnitCost,
            request.ResolutionType, request.ReplacementTripId, excludeItemId: item.Id);

        item.QtyReturned = request.QtyReturned;
        item.UnitCost = request.UnitCost;
        item.ResolutionType = request.ResolutionType.ToUpper();
        item.ResolutionAmount = request.ResolutionAmount;
        item.ReplacementTripId = request.ReplacementTripId;
        item.Note = request.Note;
        await _db.SaveChangesAsync();

        return await GetAsync(returnId);
    }

    public async Task RemoveItemAsync(Guid returnId, Guid itemId)
    {
        await RequireDraftReturnAsync(returnId);
        var item = await _db.SupplierReturnItems.FirstOrDefaultAsync(i => i.Id == itemId && i.ReturnId == returnId)
            ?? throw new KeyNotFoundException("Return item not found.");
        item.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    public async Task<SupplierReturnDetailDto> SubmitAsync(Guid returnId, Guid userId)
    {
        var ret = await RequireDraftReturnAsync(returnId);
        var hasItems = await _db.SupplierReturnItems.AnyAsync(i => i.ReturnId == returnId && i.DeletedAt == null);
        if (!hasItems)
            throw new ArgumentException("Add at least one item before submitting.");

        ret.Status = "SUBMITTED";
        await _db.SaveChangesAsync();
        await _log.LogAsync(ret.BusinessId, userId, "UPDATE", "SupplierReturn", ret.Id);
        return await GetAsync(returnId);
    }

    public async Task<SupplierReturnDetailDto> CancelAsync(Guid returnId, Guid userId)
    {
        var ret = await RequireDraftReturnAsync(returnId);
        ret.Status = "CANCELLED";
        await _db.SaveChangesAsync();
        await _log.LogAsync(ret.BusinessId, userId, "UPDATE", "SupplierReturn", ret.Id);
        return await GetAsync(returnId);
    }

    public async Task<SupplierReturnDetailDto> ResolveAsync(Guid returnId, Guid userId)
    {
        var ret = await _db.SupplierReturns
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == returnId)
            ?? throw new KeyNotFoundException("Supplier return not found.");
        if (ret.Status != "SUBMITTED")
            throw new InvalidOperationException("Only SUBMITTED returns can be resolved.");

        var items = ret.Items.Where(i => i.DeletedAt == null).ToList();

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            Guid? writeOffCategoryId = null;

            foreach (var item in items)
            {
                var inv = await _db.BranchVariantInventories
                    .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", ret.BranchId, item.VariantId)
                    .FirstOrDefaultAsync()
                    ?? throw new InvalidOperationException($"No inventory record found for variant {item.VariantId}.");

                if (inv.Damaged < item.QtyReturned)
                    throw new InvalidOperationException(
                        $"Only {inv.Damaged} damaged units remain on hand for this product — cannot resolve a return of {item.QtyReturned}.");

                inv.Damaged -= item.QtyReturned;

                var isWriteOff = item.ResolutionType == "WRITE_OFF";
                _db.StockMovements.Add(new StockMovement
                {
                    BusinessId = ret.BusinessId,
                    BranchId = ret.BranchId,
                    VariantId = item.VariantId,
                    MovementType = isWriteOff ? "DAMAGE_WRITEOFF" : "DAMAGE_OUT",
                    Qty = item.QtyReturned,
                    ReferenceType = "SupplierReturn",
                    ReferenceId = ret.Id,
                    UserId = userId,
                    Note = $"Supplier return {ret.SupplierReturnNo} ({item.ResolutionType})"
                });

                if (isWriteOff)
                {
                    writeOffCategoryId ??= await GetOrCreateWriteOffCategoryAsync();
                    _db.Expenses.Add(new Expense
                    {
                        BusinessId = ret.BusinessId,
                        BranchId = ret.BranchId,
                        CategoryId = writeOffCategoryId.Value,
                        SubType = "Damaged goods write-off",
                        Amount = item.QtyReturned * item.UnitCost,
                        ExpenseDate = DateTime.UtcNow.Date,
                        Status = "APPROVED",
                        CreatedBy = userId,
                        ApprovedBy = userId,
                        Note = $"Supplier return {ret.SupplierReturnNo}"
                    });
                }
            }

            ret.Status = "RESOLVED";
            ret.ResolvedBy = userId;
            ret.ResolvedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            await _log.LogAsync(ret.BusinessId, userId, "UPDATE", "SupplierReturn", ret.Id);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return await GetAsync(returnId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<SupplierReturn> RequireDraftReturnAsync(Guid returnId)
    {
        var ret = await _db.SupplierReturns.FirstOrDefaultAsync(r => r.Id == returnId)
            ?? throw new KeyNotFoundException("Supplier return not found.");
        if (ret.Status != "DRAFT")
            throw new InvalidOperationException("This action is only allowed on DRAFT returns.");
        return ret;
    }

    private async Task ValidateItemRequestAsync(SupplierReturn ret, Guid variantId, decimal qty, decimal unitCost,
        string resolutionType, Guid? replacementTripId, Guid? excludeItemId)
    {
        if (qty <= 0)
            throw new ArgumentException("Quantity returned must be greater than zero.");
        if (unitCost < 0)
            throw new ArgumentException("Unit cost cannot be negative.");
        if (!ValidResolutionTypes.Contains(resolutionType))
            throw new ArgumentException($"Invalid resolution type: {resolutionType}");
        if (replacementTripId.HasValue)
        {
            var tripExists = await _db.PurchaseTrips.AnyAsync(t => t.Id == replacementTripId.Value);
            if (!tripExists)
                throw new KeyNotFoundException("Replacement trip not found.");
        }

        // Guard against committing more units to returns than are actually sitting in the
        // damaged bucket for this variant/branch right now.
        var inv = await _db.BranchVariantInventories.AsNoTracking()
            .FirstOrDefaultAsync(x => x.BranchId == ret.BranchId && x.VariantId == variantId);
        var currentDamaged = inv?.Damaged ?? 0;

        var alreadyCommitted = await _db.SupplierReturnItems.AsNoTracking()
            .Where(i => i.DeletedAt == null
                && i.VariantId == variantId
                && i.Id != (excludeItemId ?? Guid.Empty)
                && (i.Return.Status == "DRAFT" || i.Return.Status == "SUBMITTED")
                && i.Return.BranchId == ret.BranchId)
            .SumAsync(i => (decimal?)i.QtyReturned) ?? 0;

        if (qty > currentDamaged - alreadyCommitted)
            throw new ArgumentException(
                $"Only {currentDamaged - alreadyCommitted} damaged units are available for this product.");
    }

    private async Task<Guid> GetOrCreateWriteOffCategoryAsync()
    {
        var existing = await _db.ExpenseCategories.FirstOrDefaultAsync(c =>
            c.BusinessId == _business.CurrentBusinessId && c.Code == "CUSTOM_PRODUCT_DAMAGE_LOSS");
        if (existing != null)
            return existing.Id;

        var category = new ExpenseCategory
        {
            BusinessId = _business.CurrentBusinessId,
            Code = "CUSTOM_PRODUCT_DAMAGE_LOSS",
            Name = "Product Damage Loss",
            IsDefault = false,
            IsActive = true
        };
        _db.ExpenseCategories.Add(category);
        await _db.SaveChangesAsync();
        return category.Id;
    }

    private async Task<string> GenerateReturnNoAsync()
    {
        var count = await _db.SupplierReturns.IgnoreQueryFilters()
            .CountAsync(r => r.BusinessId == _business.CurrentBusinessId) + 1;
        return $"SR-{count:D4}";
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
        throw new InvalidOperationException("This business has multiple branches; BranchId must be specified.");
    }

    private static SupplierReturnDetailDto MapDetail(SupplierReturn r) => new(
        r.Id, r.SupplierReturnNo, r.BranchId,
        r.SupplierId, r.Supplier.Name, r.Supplier.Address,
        r.TripId, r.Trip?.TripNo,
        r.Status, r.Note,
        r.CreatedBy, r.CreatedByUser.Name, r.CreatedAt,
        r.ResolvedBy, r.ResolvedByUser?.Name, r.ResolvedAt,
        r.Items.Where(i => i.DeletedAt == null).Select(MapItem).ToList()
    );

    private static SupplierReturnItemDto MapItem(SupplierReturnItem i) => new(
        i.Id, i.VariantId,
        i.Variant?.Sku ?? "",
        i.Variant?.Product?.Name ?? "",
        i.Variant?.Product?.UnitCode ?? "pcs",
        i.QtyReturned, i.UnitCost,
        i.ResolutionType, i.ResolutionAmount,
        i.ReplacementTripId, i.ReplacementTrip?.TripNo,
        i.Note
    );
}
