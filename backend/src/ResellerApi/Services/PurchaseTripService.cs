using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public partial class PurchaseTripService : IPurchaseTripService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;
    private readonly decimal _weightTolerancePercent;

    public PurchaseTripService(AppDbContext db, IBusinessContext business, IActivityLogService log, IConfiguration? configuration = null)
    {
        _db = db;
        _business = business;
        _log = log;
        _weightTolerancePercent = Math.Clamp(configuration?.GetValue<decimal?>("Purchases:WeightTolerancePercent") ?? 5m, 0m, 100m);
    }

    private static readonly HashSet<string> ValidSourceTypes =
        new([
            "CHINA_TRIP",
            "ONLINE_WHOLESALE",
            "ALIBABA",
            "LOCAL_WHOLESALE",
            "AGENT",
            "FACTORY_DIRECT",
            "IMPORTER_DISTRIBUTOR",
            "SOCIAL_SUPPLIER",
            "EXISTING_SUPPLIER_REORDER",
            "OPENING_BALANCE",
            "HAWKER_MARKET"
        ], StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> ValidCostTypes =
        new(["TRANSPORT", "LABOR", "CUSTOMS", "SHIPPING_INTL", "CURRENCY_LOSS", "AGENT_FEE", "PAYMENT_FEE", "OTHER", "CHINA_LOCAL", "COURIER"],
            StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> ValidTransportModes =
        new(["TRUCK", "BUS", "AIR", "COURIER", "BOAT", "WALK_IN", "OTHER"], StringComparer.OrdinalIgnoreCase);

    // ── Create ────────────────────────────────────────────────────────────────

    public async Task<PurchaseTripDetailDto> CreateAsync(CreatePurchaseTripRequest request, Guid userId)
    {
        var sourceType = request.SourceType.ToUpper();
        if (!ValidSourceTypes.Contains(sourceType))
            throw new ArgumentException($"Invalid source type: {sourceType}");

        var branchId = await ResolveBranchIdAsync(request.BranchId);

        var trip = new PurchaseTrip
        {
            BusinessId = _business.CurrentBusinessId,
            BranchId = branchId,
            TripNo = await GenerateTripNoAsync(),
            SourceType = sourceType,
            Status = "DRAFT",
            Note = request.Note,
            CreatedBy = userId
        };
        _db.PurchaseTrips.Add(trip);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "PurchaseTrip", trip.Id);
        return await GetAsync(trip.Id);
    }

    // ── List / Get ────────────────────────────────────────────────────────────

    public async Task<List<PurchaseTripSummaryDto>> ListAsync(string? status)
    {
        var q = _db.PurchaseTrips
            .AsNoTracking()
            .Include(t => t.Items)
            .Include(t => t.Costs)
            .Include(t => t.Shipments)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(t => t.Status == status.ToUpper());

        var trips = await q.OrderByDescending(t => t.CreatedAt).ToListAsync();

        var tripIds = trips.Select(t => t.Id).ToList();
        var latestReturnStatusByTrip = (await _db.SupplierReturns.AsNoTracking()
            .Where(r => r.TripId != null && tripIds.Contains(r.TripId.Value))
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new { TripId = r.TripId!.Value, r.Status })
            .ToListAsync())
            .GroupBy(r => r.TripId)
            .ToDictionary(g => g.Key, g => g.First().Status);

        return trips.Select(t => MapSummary(t, latestReturnStatusByTrip.GetValueOrDefault(t.Id))).ToList();
    }

    public async Task<PurchaseTripDetailDto> GetAsync(Guid id)
    {
        var trip = await _db.PurchaseTrips
            .AsNoTracking()
            .Include(t => t.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product)
            .Include(t => t.Items).ThenInclude(i => i.Supplier)
            .Include(t => t.Costs)
            .Include(t => t.Sessions).ThenInclude(s => s.Items)
            .Include(t => t.Shipments).ThenInclude(s => s.Items)
            .Include(t => t.Sessions).ThenInclude(s => s.ReceivedByUser)
            .Include(t => t.Sessions).ThenInclude(s => s.ApprovedByUser)
            .FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new KeyNotFoundException("Purchase trip not found.");

        var returnsByVariant = (await _db.SupplierReturnItems.AsNoTracking()
            .Where(sri => sri.DeletedAt == null && sri.Return.TripId == id)
            .OrderByDescending(sri => sri.CreatedAt)
            .Select(sri => new VariantReturnInfo(sri.VariantId, sri.ReturnId, sri.Return.SupplierReturnNo, sri.Return.Status, sri.QtyReturned))
            .ToListAsync())
            .GroupBy(x => x.VariantId)
            .ToDictionary(g => g.Key, g => g.First());

        return MapDetail(trip, returnsByVariant);
    }

    public async Task<PurchaseTripDetailDto> UpdateHeaderAsync(Guid tripId, UpdateTripHeaderRequest request, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");

        if (trip.Status == "COMPLETED" || trip.Status == "CANCELLED")
            throw new InvalidOperationException("Cannot edit header of a completed or cancelled order.");

        trip.ExpectedDeliveryDate = request.ExpectedDeliveryDate;
        trip.SupplierPoRef = string.IsNullOrWhiteSpace(request.SupplierPoRef) ? null : request.SupplierPoRef.Trim();

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseTrip", trip.Id);
        return await GetAsync(trip.Id);
    }

    public async Task<PurchaseTripDetailDto> UpdateAttachmentsAsync(
        Guid tripId, UpdateTripAttachmentsRequest request, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        ValidateAttachments(request.Attachments);
        trip.AttachmentsJson = System.Text.Json.JsonSerializer.Serialize(request.Attachments);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseTripAttachments", trip.Id);
        return await GetAsync(trip.Id);
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    private async Task AssignProductBrandAsync(Product product, Guid? brandId)
    {
        if (!brandId.HasValue) return;
        if (!await _db.Brands.AnyAsync(b => b.Id == brandId.Value))
            throw new ArgumentException("Brand not found in this business.");
        product.BrandId = brandId;
    }

    public async Task<PurchaseItemDto> AddItemAsync(Guid tripId, AddPurchaseItemRequest request, Guid userId)
    {
        await using var paymentLock = await new ExpenseFundingService(_db, _business).BeginAsync();
        if (await _db.PurchasePayments.AnyAsync(p => p.TripId == tripId && p.CostKey == Guid.Empty))
            throw new InvalidOperationException("This purchase has a recorded payment. Paid amounts cannot be changed or cancelled.");

        var trip = await RequireDraftTripAsync(tripId);
        if (request.QtyBought <= 0 || request.TotalCost < 0 || Math.Round(request.QtyBought, 3) != request.QtyBought || Math.Round(request.TotalCost, 2) != request.TotalCost)
            throw new ArgumentException("Enter a positive quantity and a valid BDT cost.");
        if (request.UnitWeightGrams < 0)
            throw new InvalidOperationException("Unit weight cannot be negative.");

        var variant = await _db.ProductVariants.Include(v => v.Product).FirstOrDefaultAsync(v => v.Id == request.VariantId)
            ?? throw new KeyNotFoundException("Variant not found.");

        await AssignProductBrandAsync(variant.Product, request.BrandId);
        Supplier? supplier = null;
        if (request.SupplierId.HasValue)
        {
            supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.SupplierId.Value)
                ?? throw new KeyNotFoundException("Supplier not found.");
            supplier.LastUsedAt = DateTime.UtcNow;
            supplier.UsageCount++;
        }

        var item = new PurchaseItem
        {
            TripId = trip.Id,
            VariantId = request.VariantId,
            QtyBought = request.QtyBought,
            TotalCost = request.TotalCost,
            UnitWeightGrams = request.UnitWeightGrams > 0 ? request.UnitWeightGrams : variant.UnitWeightGrams,
            SupplierId = request.SupplierId,
            ShopName = supplier?.Name,
            MemoPhotoUrl = request.MemoPhotoUrl,
            PaidNow = request.PaidNow,
            DueAmount = request.DueAmount,
            PromisedDate = request.PromisedDate
        };
        _db.PurchaseItems.Add(item);
        await _db.SaveChangesAsync();
        if (paymentLock != null) await paymentLock.CommitAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "PurchaseItem", item.Id);

        await _db.Entry(item).Reference(i => i.Variant).LoadAsync();
        await _db.Entry(item.Variant).Reference(v => v.Product).LoadAsync();
        if (supplier != null) item.Supplier = supplier;
        return MapItem(item);
    }

    public async Task<PurchaseItemDto> UpdateItemAsync(Guid tripId, Guid itemId, UpdatePurchaseItemRequest request, Guid userId)
    {
        await using var paymentLock = await new ExpenseFundingService(_db, _business).BeginAsync();
        if (await _db.PurchasePayments.AnyAsync(p => p.TripId == tripId && (p.CostKey == Guid.Empty || p.PurchaseItemId == itemId)))
            throw new InvalidOperationException("This purchase has a recorded payment. Paid amounts cannot be changed or cancelled.");

        await RequireDraftTripAsync(tripId);
        if (request.QtyBought <= 0 || request.TotalCost < 0 || Math.Round(request.QtyBought, 3) != request.QtyBought || Math.Round(request.TotalCost, 2) != request.TotalCost)
            throw new ArgumentException("Enter a positive quantity and a valid BDT cost.");
        if (request.UnitWeightGrams < 0)
            throw new InvalidOperationException("Unit weight cannot be negative.");
        var item = await _db.PurchaseItems
            .Include(i => i.Variant).ThenInclude(v => v.Product)
            .FirstOrDefaultAsync(i => i.Id == itemId && i.TripId == tripId)
            ?? throw new KeyNotFoundException("Purchase item not found.");

        if (request.SupplierId.HasValue && request.SupplierId != item.SupplierId)
        {
            var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.SupplierId.Value)
                ?? throw new KeyNotFoundException("Supplier not found.");
            supplier.LastUsedAt = DateTime.UtcNow;
            supplier.UsageCount++;
            item.SupplierId = request.SupplierId;
            item.ShopName = supplier.Name;
            item.Supplier = supplier;
        }
        else if (!request.SupplierId.HasValue)
        {
            item.SupplierId = null;
            item.ShopName = null;
            item.Supplier = null;
        }

        await AssignProductBrandAsync(item.Variant.Product, request.BrandId);
        item.QtyBought = request.QtyBought;
        item.TotalCost = request.TotalCost;
        item.UnitWeightGrams = request.UnitWeightGrams;
        item.MemoPhotoUrl = request.MemoPhotoUrl;
        item.PaidNow = request.PaidNow;
        item.DueAmount = request.DueAmount;
        item.PromisedDate = request.PromisedDate;
        await _db.SaveChangesAsync();
        if (paymentLock != null) await paymentLock.CommitAsync();
        return MapItem(item);
    }

    public async Task RemoveItemAsync(Guid tripId, Guid itemId, Guid userId)
    {
        await using var paymentLock = await new ExpenseFundingService(_db, _business).BeginAsync();
        if (await _db.PurchasePayments.AnyAsync(p => p.TripId == tripId && (p.CostKey == Guid.Empty || p.PurchaseItemId == itemId)))
            throw new InvalidOperationException("This purchase has a recorded payment. Paid amounts cannot be changed or cancelled.");

        await RequireDraftTripAsync(tripId);
        var item = await _db.PurchaseItems.FirstOrDefaultAsync(i => i.Id == itemId && i.TripId == tripId)
            ?? throw new KeyNotFoundException("Purchase item not found.");
        item.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        if (paymentLock != null) await paymentLock.CommitAsync();
    }

    // ── Costs ─────────────────────────────────────────────────────────────────

    public async Task<PurchaseTripCostDto> AddCostAsync(Guid tripId, AddPurchaseTripCostRequest request, Guid userId)
    {
        await using var tx = await new ExpenseFundingService(_db, _business).BeginAsync();
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status == "CANCELLED") throw new InvalidOperationException("Cannot add costs to a cancelled PO.");
        ExpenseFundingService.ToPaisa(request.Amount);
        await ValidateCostScopeAsync(trip, request.ShipmentId, request.CostType.ToUpperInvariant(), trip.Status == "COMPLETED");

        var costType = request.CostType.ToUpper();
        if (!ValidCostTypes.Contains(costType))
            throw new ArgumentException($"Invalid cost type: {costType}");

        var cost = new PurchaseTripCost
        {
            TripId = trip.Id,
            CostType = costType,
            ShipmentId = request.ShipmentId,
            Amount = request.Amount,
            Note = request.Note,
            PhotoUrl = request.PhotoUrl,
            PaidBy = request.PaidBy,
            IsPostCompletion = trip.Status == "COMPLETED"
        };
        _db.PurchaseTripCosts.Add(cost);
        await _db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "PurchaseTripCost", cost.Id);
        return MapCost(cost);
    }

    public async Task RemoveCostAsync(Guid tripId, Guid costId, Guid userId)
    {
        await using var paymentLock = await new ExpenseFundingService(_db, _business).BeginAsync();
        if (await _db.PurchasePayments.AnyAsync(p => p.TripId == tripId && p.CostKey == costId))
            throw new InvalidOperationException("This purchase has a recorded payment. Paid amounts cannot be changed or cancelled.");

        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status == "CANCELLED")
            throw new InvalidOperationException("Cannot modify a cancelled trip.");

        var cost = await _db.PurchaseTripCosts.FirstOrDefaultAsync(c => c.Id == costId && c.TripId == tripId)
            ?? throw new KeyNotFoundException("Cost not found.");

        if (trip.Status == "COMPLETED" && !cost.IsPostCompletion)
            throw new InvalidOperationException("Pre-completion costs are locked and cannot be removed.");

        await ValidateCostScopeAsync(trip, cost.ShipmentId, cost.CostType, cost.IsPostCompletion);
        cost.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        if (paymentLock != null) await paymentLock.CommitAsync();
    }

    public async Task<PurchaseShipmentDto?> GetShipmentAsync(Guid tripId)
    {
        var tripExists = await _db.PurchaseTrips.AsNoTracking().AnyAsync(t => t.Id == tripId);
        if (!tripExists) throw new KeyNotFoundException("Purchase trip not found.");
        var shipment = await _db.PurchaseShipments.AsNoTracking().FirstOrDefaultAsync(x => x.TripId == tripId && x.IsLegacy);
        return shipment == null ? null : MapShipment(shipment);
    }

    public Task<PurchaseShipmentDto> SaveShipmentAsync(Guid tripId, SavePurchaseShipmentRequest request, Guid userId)
        => throw new InvalidOperationException("Use the Lots section to create a shipment and record its BDT costs.");

    public Task RemoveShipmentAsync(Guid tripId, Guid userId)
        => throw new InvalidOperationException("Historical shipping records are preserved. Use the Lots section.");

    // ── Trip lifecycle ────────────────────────────────────────────────────────

    public async Task<PurchaseTripDetailDto> SubmitForApprovalAsync(Guid tripId, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status != "DRAFT") throw new InvalidOperationException("Only draft POs can be submitted.");
        return await GetAsync(trip.Id);
    }

    public async Task<PurchaseTripDetailDto> ApproveAsync(Guid tripId, string? note, Guid userId)
    {
        await using var paymentLock = await new ExpenseFundingService(_db, _business).BeginAsync();
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status is not ("DRAFT" or "PENDING_APPROVAL"))
            throw new InvalidOperationException("Only draft POs can be approved.");
        var paymentRows = await _db.PurchasePayments.Where(p => p.TripId == tripId).ToListAsync();
        var items = await _db.PurchaseItems.Where(i => i.TripId == tripId).ToListAsync();
        var costs = await _db.PurchaseTripCosts.Where(c => c.TripId == tripId && c.ShipmentId == null && !c.IsPostCompletion).ToListAsync();
        if (items.Count == 0) throw new InvalidOperationException("Add products before approval.");
        var legacyPaid = paymentRows.Any(p => p.CostKey == Guid.Empty && p.Amount == items.Sum(i => i.TotalCost));
        if ((!legacyPaid && items.Any(i => i.TotalCost > 0 && !paymentRows.Any(p => p.PurchaseItemId == i.Id && p.Amount == i.TotalCost))) ||
            costs.Any(c => c.Amount > 0 && !paymentRows.Any(p => p.CostKey == c.Id && p.Amount == c.Amount)))
            throw new InvalidOperationException("Record full payment for every product and common PO cost before product approval.");
        trip.Status = "PRODUCT_APPROVED";
        trip.ApprovedBy = userId;
        trip.ApprovalNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        await _db.SaveChangesAsync();
        if (paymentLock != null) await paymentLock.CommitAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseTrip", trip.Id);
        return await GetAsync(trip.Id);
    }

    public async Task<PurchaseTripDetailDto> CancelAsync(Guid tripId, Guid userId)
    {
        await using var paymentLock = await new ExpenseFundingService(_db, _business).BeginAsync();
        if (await _db.PurchasePayments.AnyAsync(p => p.TripId == tripId))
            throw new InvalidOperationException("This purchase has a recorded payment. Paid amounts cannot be changed or cancelled.");

        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status == "COMPLETED")
            throw new InvalidOperationException("Completed trips cannot be cancelled.");
        trip.Status = "CANCELLED";
        await _db.SaveChangesAsync();
        if (paymentLock != null) await paymentLock.CommitAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseTrip", trip.Id);
        return await GetAsync(trip.Id);
    }

    // ── Receive sessions ──────────────────────────────────────────────────────

    public async Task<PurchaseTripDetailDto> RejectSessionAsync(Guid tripId, Guid sessionId, string? reason, Guid userId)
    {
        await using var tx = await new ExpenseFundingService(_db, _business).BeginAsync();
        var session = await _db.PurchaseReceiveSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.TripId == tripId)
            ?? throw new KeyNotFoundException("Receive session not found.");

        if (session.Status != "PENDING_APPROVAL")
            throw new InvalidOperationException("Only PENDING_APPROVAL sessions can be rejected.");

        session.Status = "REJECTED";
        session.RejectionReason = reason;
        await _db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseReceiveSession", session.Id);
        return await GetAsync(tripId);
    }

    // ── Close trip ────────────────────────────────────────────────────────────

    public async Task<PurchaseTripDetailDto> CloseTripAsync(Guid tripId, string? forceCloseReason, Guid userId)
    {
        await using var tx = await new ExpenseFundingService(_db, _business).BeginAsync();
        var trip = await _db.PurchaseTrips
            .Include(t => t.Items)
            .Include(t => t.Sessions)
            .FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");

        if (!ApprovedPurchase(trip))
            throw new InvalidOperationException("Only approved, open POs can be closed.");

        if (trip.Sessions.Any(s => s.DeletedAt == null && s.Status == "PENDING_APPROVAL"))
            throw new InvalidOperationException("Approve or reject all pending sessions before closing the trip.");

        var hasRemaining = trip.Items.Any(i =>
            i.DeletedAt == null && i.QtyUsable + i.QtyDamaged + i.QtyMissing < i.QtyBought);

        if (hasRemaining)
        {
            if (string.IsNullOrWhiteSpace(forceCloseReason))
                throw new UnaccountedUnitsException(
                    trip.Items
                        .Where(i => i.DeletedAt == null && i.QtyUsable + i.QtyDamaged + i.QtyMissing < i.QtyBought)
                        .Select(i => new UnaccountedItem(
                            i.Variant?.Sku ?? i.VariantId.ToString(),
                            i.Variant?.Product?.Name ?? "",
                            i.QtyBought,
                            i.QtyUsable + i.QtyDamaged + i.QtyMissing,
                            i.QtyBought - i.QtyUsable - i.QtyDamaged - i.QtyMissing))
                        .ToList());

            trip.ForceCompleteReason = forceCloseReason;
        }

        trip.Status = "COMPLETED";
        trip.CompletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseTrip", trip.Id);
        return await GetAsync(trip.Id);
    }

    // ── Cost allocation formulas (R5.6) ───────────────────────────────────────

    public static (decimal AllocatedSharedCost, decimal LandedUnitCost) ComputeLandedCost(
        decimal itemTotalCost, decimal allItemsTotalCost, decimal sharedCosts, decimal qtyUsable)
    {
        var allocated = allItemsTotalCost == 0
            ? 0
            : Math.Round(itemTotalCost / allItemsTotalCost * sharedCosts, 2);
        var landedUnit = Math.Round((itemTotalCost + allocated) / qtyUsable, 2);
        return (allocated, landedUnit);
    }

    public static decimal ComputeNewAvgCost(decimal oldOnHand, decimal oldAvg, decimal qtyUsable, decimal landedUnit)
    {
        var totalQty = oldOnHand + qtyUsable;
        if (totalQty == 0) return landedUnit;
        return Math.Round((oldOnHand * oldAvg + qtyUsable * landedUnit) / totalQty, 2);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static bool IsUniqueConstraintViolation(DbUpdateException ex) =>
        ex.InnerException is SqlException sqlEx && (sqlEx.Number == 2627 || sqlEx.Number == 2601);

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

    private async Task<PurchaseTrip> RequireDraftTripAsync(Guid tripId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status != "DRAFT")
            throw new InvalidOperationException("This action is only allowed on DRAFT trips.");
        return trip;
    }

    private async Task<string> GenerateTripNoAsync()
    {
        var count = await _db.PurchaseTrips.IgnoreQueryFilters()
            .CountAsync(t => t.BusinessId == _business.CurrentBusinessId) + 1;
        return $"PT-{count:D4}";
    }

    private async Task<string> GenerateSessionNoAsync(Guid tripId)
    {
        var count = await _db.PurchaseReceiveSessions.IgnoreQueryFilters()
            .CountAsync(s => s.TripId == tripId) + 1;
        return $"RS-{count:D3}";
    }

    private static void ValidateSessionItemQty(PurchaseItem item, decimal qtyUsable, decimal qtyDamaged, decimal qtyMissing)
    {
        if (qtyUsable < 0)
            throw new ArgumentException($"Usable quantity cannot be negative for item {item.Id}.");
        if (qtyDamaged < 0)
            throw new ArgumentException($"Damaged quantity cannot be negative for item {item.Id}.");
        if (qtyMissing < 0)
            throw new ArgumentException($"Missing quantity cannot be negative for item {item.Id}.");
        var remaining = item.QtyBought - item.QtyUsable - item.QtyDamaged - item.QtyMissing;
        if (qtyUsable + qtyDamaged + qtyMissing > remaining)
            throw new ArgumentException(
                $"Total entered ({qtyUsable + qtyDamaged + qtyMissing}) exceeds remaining ({remaining}) for item {item.Id}.");
        if (qtyUsable + qtyDamaged + qtyMissing == 0)
            throw new ArgumentException($"Must specify at least some quantity for item {item.Id}.");
    }

    private static PurchaseTripSummaryDto MapSummary(PurchaseTrip t, string? supplierReturnStatus = null)
    {
        var activeItems = t.Items.Where(i => i.DeletedAt == null).ToList();
        return new PurchaseTripSummaryDto(
            t.Id, t.TripNo, t.SourceType, t.Status,
            activeItems.Count,
            activeItems.Sum(i => i.QtyBought),
            activeItems.Sum(i => i.QtyUsable),
            activeItems.Sum(i => i.QtyDamaged),
            activeItems.Sum(i => i.TotalCost),
            t.Costs.Where(c => c.DeletedAt == null && !c.IsPostCompletion).Sum(c => c.Amount),
            t.CreatedAt,
            supplierReturnStatus
        );
    }

    private sealed record VariantReturnInfo(Guid VariantId, Guid ReturnId, string SupplierReturnNo, string Status, decimal QtyReturned);

    private PurchaseTripDetailDto MapDetail(PurchaseTrip t, Dictionary<Guid, VariantReturnInfo>? returnsByVariant = null) => new(
        t.Id, t.TripNo, t.SourceType, t.Status, t.Note, t.ApprovalNote,
        t.ExpectedDeliveryDate, t.SupplierPoRef,
        t.CreatedAt, t.CompletedAt, t.ForceCompleteReason,
        t.Items.Where(i => i.DeletedAt == null).Select(i => MapItem(i, returnsByVariant)).ToList(),
        t.Costs.Where(c => c.DeletedAt == null).Select(MapCost).ToList(),
        t.Sessions.Where(s => s.DeletedAt == null).OrderBy(s => s.ReceivedAt).Select(MapSession).ToList(),
        DeserializeAttachments(t.AttachmentsJson),
        t.Shipments.Where(s => s.DeletedAt == null && s.IsLegacy).Select(MapShipment).FirstOrDefault(),
        t.Shipments.Where(s => s.DeletedAt == null && !s.IsLegacy).OrderBy(s => s.CreatedAt).Select(MapLot).ToList(),
        t.UsesShipmentLots
    );

    private static PurchaseItemDto MapItem(PurchaseItem i, Dictionary<Guid, VariantReturnInfo>? returnsByVariant = null)
    {
        VariantReturnInfo? ret = null;
        returnsByVariant?.TryGetValue(i.VariantId, out ret);
        return new(
            i.Id, i.VariantId,
            i.Variant?.Sku ?? "",
            i.Variant?.Product?.Name ?? "",
            i.Variant?.Product?.UnitCode ?? "pcs",
            i.QtyBought, i.QtyUsable, i.QtyDamaged, i.TotalCost, i.UnitWeightGrams,
            i.SupplierId, i.Supplier?.Name ?? i.ShopName, i.Supplier?.Address,
            i.MemoPhotoUrl,
            i.PaidNow, i.DueAmount, i.PromisedDate,
            i.AllocatedSharedCost, i.LandedUnitCost,
            ret?.ReturnId, ret?.SupplierReturnNo, ret?.Status, ret?.QtyReturned,
            i.QtyMissing, i.QtyShipped
        );
    }

    private static PurchaseTripCostDto MapCost(PurchaseTripCost c) => new(
        c.Id, c.CostType, c.Amount, c.Note, c.PhotoUrl, c.PaidBy, c.IsPostCompletion, c.ShipmentId
    );

    private static PurchaseShipmentDto MapShipment(PurchaseShipment s) => new(
        s.Id, s.ShippingCompanyId, s.ShippingCompanyNameSnapshot, s.ShippingMethod,
        s.ChargeBasis, s.RateAmountSnapshot, s.CurrencyCode, s.BillableQuantity,
        s.CalculatedCost, s.TrackingNumber, s.Note
    );

    private static PurchaseReceiveSessionDto MapSession(PurchaseReceiveSession s) => new(
        s.Id, s.SessionNo,
        s.ReceivedBy, s.ReceivedByUser?.Name ?? "",
        s.ReceivedAt, s.TransportMode, s.VehicleOrTrackingNo, s.Note,
        s.Status,
        s.ApprovedBy, s.ApprovedByUser?.Name,
        s.ApprovedAt, s.RejectionReason,
        s.Items.Where(i => i.DeletedAt == null).Select(i =>
            new PurchaseReceiveItemDto(i.Id, i.PurchaseItemId, i.QtyUsable, i.QtyDamaged, i.PerLotValuesJson, i.QtyMissing, i.MeasuredWeightGrams, i.AllocatedShippingCost, i.LossAmount)
        ).ToList(),
        DeserializeAttachments(s.AttachmentsJson), s.ShipmentId
    );

    private static List<PurchaseReceiveAttachmentDto> DeserializeAttachments(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<PurchaseReceiveAttachmentDto>>(json) ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

    private static void ValidateAttachments(List<PurchaseReceiveAttachmentDto> attachments)
    {
        var allowedTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg", "image/png", "image/webp", "application/pdf"
        };
        if (attachments.Count > 10)
            throw new ArgumentException("A receive session can contain at most 10 attachments.");
        foreach (var attachment in attachments)
        {
            if (string.IsNullOrWhiteSpace(attachment.Name) || attachment.Name.Length > 200)
                throw new ArgumentException("Attachment name is invalid.");
            if (!attachment.Url.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Attachment URL is invalid.");
            if (!allowedTypes.Contains(attachment.ContentType))
                throw new ArgumentException("Attachment type is not allowed.");
            if (attachment.SizeBytes <= 0 || attachment.SizeBytes > 5 * 1024 * 1024)
                throw new ArgumentException("Attachment must be 5MB or smaller.");
        }
    }
}
