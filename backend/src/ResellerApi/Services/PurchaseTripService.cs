using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PurchaseTripService : IPurchaseTripService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public PurchaseTripService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
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
        new(["TRANSPORT", "LABOR", "CUSTOMS", "SHIPPING_INTL", "CURRENCY_LOSS", "AGENT_FEE", "PAYMENT_FEE", "OTHER"],
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

    public async Task<PurchaseItemDto> AddItemAsync(Guid tripId, AddPurchaseItemRequest request, Guid userId)
    {
        var trip = await RequireDraftTripAsync(tripId);
        if (request.UnitWeightGrams < 0)
            throw new InvalidOperationException("Unit weight cannot be negative.");

        var variant = await _db.ProductVariants.FirstOrDefaultAsync(v => v.Id == request.VariantId)
            ?? throw new KeyNotFoundException("Variant not found.");

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
            UnitWeightGrams = request.UnitWeightGrams,
            SupplierId = request.SupplierId,
            ShopName = supplier?.Name,
            MemoPhotoUrl = request.MemoPhotoUrl,
            PaidNow = request.PaidNow,
            DueAmount = request.DueAmount,
            PromisedDate = request.PromisedDate
        };
        _db.PurchaseItems.Add(item);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "PurchaseItem", item.Id);

        await _db.Entry(item).Reference(i => i.Variant).LoadAsync();
        await _db.Entry(item.Variant).Reference(v => v.Product).LoadAsync();
        if (supplier != null) item.Supplier = supplier;
        return MapItem(item);
    }

    public async Task<PurchaseItemDto> UpdateItemAsync(Guid tripId, Guid itemId, UpdatePurchaseItemRequest request, Guid userId)
    {
        await RequireDraftTripAsync(tripId);
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

        item.QtyBought = request.QtyBought;
        item.TotalCost = request.TotalCost;
        item.UnitWeightGrams = request.UnitWeightGrams;
        item.MemoPhotoUrl = request.MemoPhotoUrl;
        item.PaidNow = request.PaidNow;
        item.DueAmount = request.DueAmount;
        item.PromisedDate = request.PromisedDate;
        await _db.SaveChangesAsync();
        return MapItem(item);
    }

    public async Task RemoveItemAsync(Guid tripId, Guid itemId, Guid userId)
    {
        await RequireDraftTripAsync(tripId);
        var item = await _db.PurchaseItems.FirstOrDefaultAsync(i => i.Id == itemId && i.TripId == tripId)
            ?? throw new KeyNotFoundException("Purchase item not found.");
        item.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    // ── Costs ─────────────────────────────────────────────────────────────────

    public async Task<PurchaseTripCostDto> AddCostAsync(Guid tripId, AddPurchaseTripCostRequest request, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status != "DRAFT" && trip.Status != "RECEIVING" && trip.Status != "COMPLETED")
            throw new InvalidOperationException("Costs can only be added to DRAFT, RECEIVING, or COMPLETED trips.");

        var costType = request.CostType.ToUpper();
        if (!ValidCostTypes.Contains(costType))
            throw new ArgumentException($"Invalid cost type: {costType}");

        var cost = new PurchaseTripCost
        {
            TripId = trip.Id,
            CostType = costType,
            Amount = request.Amount,
            Note = request.Note,
            PhotoUrl = request.PhotoUrl,
            PaidBy = request.PaidBy,
            IsPostCompletion = trip.Status == "COMPLETED"
        };
        _db.PurchaseTripCosts.Add(cost);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "PurchaseTripCost", cost.Id);
        return MapCost(cost);
    }

    public async Task RemoveCostAsync(Guid tripId, Guid costId, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status == "CANCELLED")
            throw new InvalidOperationException("Cannot modify a cancelled trip.");

        var cost = await _db.PurchaseTripCosts.FirstOrDefaultAsync(c => c.Id == costId && c.TripId == tripId)
            ?? throw new KeyNotFoundException("Cost not found.");

        if (trip.Status == "COMPLETED" && !cost.IsPostCompletion)
            throw new InvalidOperationException("Pre-completion costs are locked and cannot be removed.");

        cost.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<PurchaseShipmentDto?> GetShipmentAsync(Guid tripId)
    {
        var tripExists = await _db.PurchaseTrips.AsNoTracking().AnyAsync(t => t.Id == tripId);
        if (!tripExists) throw new KeyNotFoundException("Purchase trip not found.");
        var shipment = await _db.PurchaseShipments.AsNoTracking().FirstOrDefaultAsync(x => x.TripId == tripId);
        return shipment == null ? null : MapShipment(shipment);
    }

    public async Task<PurchaseShipmentDto> SaveShipmentAsync(Guid tripId, SavePurchaseShipmentRequest request, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status != "DRAFT" && trip.Status != "RECEIVING")
            throw new InvalidOperationException("Shipping can only be changed for DRAFT or RECEIVING purchases.");
        if (request.BillableQuantity <= 0) throw new ArgumentException("Billable weight must be greater than zero.");

        var method = request.ShippingMethod.Trim().ToUpperInvariant();
        if (method is not ("AIR" or "SEA")) throw new ArgumentException("Shipping method must be AIR or SEA.");
        var company = await _db.ShippingCompanies.Include(x => x.Rates)
            .FirstOrDefaultAsync(x => x.Id == request.ShippingCompanyId && x.IsActive)
            ?? throw new KeyNotFoundException("Shipping company not found.");
        var rate = company.Rates.FirstOrDefault(x => x.DeletedAt == null && x.IsActive && x.ShippingMethod == method && x.ChargeBasis == "PER_KG")
            ?? throw new InvalidOperationException($"{company.Name} does not have an active {method} rate.");
        var amount = Math.Round(Math.Max(request.BillableQuantity * rate.RateAmount, rate.MinimumCharge ?? 0), 2);
        var shipment = await _db.PurchaseShipments.Include(x => x.PurchaseTripCost).FirstOrDefaultAsync(x => x.TripId == tripId);
        if (shipment == null)
        {
            var cost = new PurchaseTripCost { TripId = tripId, CostType = "SHIPPING_INTL", Amount = amount, IsPostCompletion = false };
            shipment = new PurchaseShipment { TripId = tripId, ShippingCompanyId = company.Id, PurchaseTripCost = cost };
            _db.PurchaseShipments.Add(shipment);
        }
        shipment.ShippingCompanyId = company.Id;
        shipment.ShippingCompanyRateId = rate.Id;
        shipment.ShippingCompanyNameSnapshot = company.Name;
        shipment.ShippingMethod = method;
        shipment.ChargeBasis = rate.ChargeBasis;
        shipment.RateAmountSnapshot = rate.RateAmount;
        shipment.CurrencyCode = rate.CurrencyCode;
        shipment.BillableQuantity = request.BillableQuantity;
        shipment.CalculatedCost = amount;
        shipment.TrackingNumber = string.IsNullOrWhiteSpace(request.TrackingNumber) ? null : request.TrackingNumber.Trim();
        shipment.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        shipment.PurchaseTripCost.Amount = amount;
        shipment.PurchaseTripCost.Note = $"{company.Name} · {method} · {request.BillableQuantity:0.###} kg × ৳{rate.RateAmount:0.##}";
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseShipment", shipment.Id);
        return MapShipment(shipment);
    }

    public async Task RemoveShipmentAsync(Guid tripId, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status != "DRAFT" && trip.Status != "RECEIVING")
            throw new InvalidOperationException("Shipping can only be removed from DRAFT or RECEIVING purchases.");
        var shipment = await _db.PurchaseShipments.Include(x => x.PurchaseTripCost).FirstOrDefaultAsync(x => x.TripId == tripId)
            ?? throw new KeyNotFoundException("Purchase shipping not found.");
        shipment.DeletedAt = DateTime.UtcNow;
        shipment.PurchaseTripCost.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "DELETE", "PurchaseShipment", shipment.Id);
    }

    // ── Trip lifecycle ────────────────────────────────────────────────────────

    public async Task<PurchaseTripDetailDto> SubmitForApprovalAsync(Guid tripId, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status != "DRAFT")
            throw new InvalidOperationException("Only DRAFT trips can be submitted.");
        trip.Status = "PENDING_APPROVAL";
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseTrip", trip.Id);
        return await GetAsync(trip.Id);
    }

    public async Task<PurchaseTripDetailDto> ApproveAsync(Guid tripId, string? note, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status != "PENDING_APPROVAL")
            throw new InvalidOperationException("Only PENDING_APPROVAL trips can be approved.");
        trip.Status = "RECEIVING";
        trip.ApprovedBy = userId;
        trip.ApprovalNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseTrip", trip.Id);
        return await GetAsync(trip.Id);
    }

    public async Task<PurchaseTripDetailDto> CancelAsync(Guid tripId, Guid userId)
    {
        var trip = await _db.PurchaseTrips.FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");
        if (trip.Status == "COMPLETED")
            throw new InvalidOperationException("Completed trips cannot be cancelled.");
        trip.Status = "CANCELLED";
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseTrip", trip.Id);
        return await GetAsync(trip.Id);
    }

    // ── Receive sessions ──────────────────────────────────────────────────────

    public async Task<PurchaseTripDetailDto> CreateReceiveSessionAsync(
        Guid tripId, CreateReceiveSessionRequest request, Guid userId, bool isOwner)
    {
        var trip = await _db.PurchaseTrips
            .Include(t => t.Items)
            .Include(t => t.Costs)
            .FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");

        if (trip.Status != "RECEIVING" && trip.Status != "DRAFT")
            throw new InvalidOperationException("Sessions can only be created for RECEIVING or DRAFT trips.");
        if (!trip.Items.Any())
            throw new InvalidOperationException("Trip must have at least one item.");

        var mode = request.TransportMode.ToUpper();
        if (!ValidTransportModes.Contains(mode))
            throw new ArgumentException($"Invalid transport mode: {mode}");

        if (!request.Items.Any())
            throw new InvalidOperationException("Session must include at least one item.");

        var attachments = request.Attachments ?? [];
        ValidateAttachments(attachments);

        // Validate quantities — cannot exceed remaining (QtyBought - already committed totals)
        foreach (var input in request.Items)
        {
            var item = trip.Items.FirstOrDefault(i => i.Id == input.PurchaseItemId)
                ?? throw new KeyNotFoundException($"Item {input.PurchaseItemId} not found in trip.");
            ValidateSessionItemQty(item, input.QtyUsable, input.QtyDamaged, input.QtyMissing);
        }

        var session = new PurchaseReceiveSession
        {
            BusinessId = trip.BusinessId,
            BranchId = trip.BranchId,
            TripId = tripId,
            SessionNo = await GenerateSessionNoAsync(tripId),
            ReceivedBy = userId,
            ReceivedAt = request.ReceivedAt,
            TransportMode = mode,
            VehicleOrTrackingNo = request.VehicleOrTrackingNo,
            Note = request.Note,
            AttachmentsJson = System.Text.Json.JsonSerializer.Serialize(attachments),
            Status = "PENDING_APPROVAL"
        };
        _db.PurchaseReceiveSessions.Add(session);
        await _db.SaveChangesAsync();

        foreach (var input in request.Items)
        {
            _db.PurchaseReceiveItems.Add(new PurchaseReceiveItem
            {
                SessionId = session.Id,
                PurchaseItemId = input.PurchaseItemId,
                QtyUsable = input.QtyUsable,
                QtyDamaged = input.QtyDamaged,
                QtyMissing = input.QtyMissing,
                PerLotValuesJson = input.PerLotValuesJson
            });
        }
        await _db.SaveChangesAsync();

        // If owner creates the session, auto-approve immediately
        if (isOwner)
            return await ApproveSessionAsync(tripId, session.Id, userId);

        await _log.LogAsync(trip.BusinessId, userId, "CREATE", "PurchaseReceiveSession", session.Id);
        return await GetAsync(tripId);
    }

    public async Task<CompleteTripPreviewDto> PreviewSessionAsync(Guid tripId, Guid sessionId)
    {
        var trip = await _db.PurchaseTrips
            .AsNoTracking()
            .Include(t => t.Items).ThenInclude(i => i.Variant).ThenInclude(v => v!.Product)
            .Include(t => t.Costs)
            .Include(t => t.Sessions).ThenInclude(s => s.Items)
            .FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");

        var session = trip.Sessions.FirstOrDefault(s => s.Id == sessionId)
            ?? throw new KeyNotFoundException("Receive session not found.");

        if (session.Status != "PENDING_APPROVAL")
            throw new InvalidOperationException("Preview is only available for PENDING_APPROVAL sessions.");

        var sharedTotal = trip.Costs.Where(c => !c.IsPostCompletion).Sum(c => c.Amount);
        var totalItemCost = trip.Items.Sum(i => i.TotalCost);
        var previews = new List<LandedCostPreviewDto>();

        foreach (var si in session.Items.Where(i => i.QtyUsable > 0))
        {
            var item = trip.Items.FirstOrDefault(i => i.Id == si.PurchaseItemId);
            if (item == null) continue;

            var (allocated, landedUnit) = ComputeLandedCost(item.TotalCost, totalItemCost, sharedTotal, si.QtyUsable);
            var inv = await _db.BranchVariantInventories.AsNoTracking()
                .FirstOrDefaultAsync(vi => vi.BranchId == trip.BranchId && vi.VariantId == item.VariantId);
            var oldAvg = item.Variant?.AvgLandedCost ?? 0;
            var oldOnHand = inv?.OnHand ?? 0;

            previews.Add(new LandedCostPreviewDto(
                item.Id,
                item.Variant?.Product?.Name ?? "",
                item.Variant?.Sku ?? "",
                si.QtyUsable, item.TotalCost, allocated, landedUnit,
                oldAvg,
                ComputeNewAvgCost(oldOnHand, oldAvg, si.QtyUsable, landedUnit)
            ));
        }

        return new CompleteTripPreviewDto(sharedTotal, previews);
    }

    public async Task<PurchaseTripDetailDto> ApproveSessionAsync(Guid tripId, Guid sessionId, Guid userId)
    {
        var trip = await _db.PurchaseTrips
            .Include(t => t.Items)
            .Include(t => t.Costs)
            .Include(t => t.Sessions).ThenInclude(s => s.Items)
            .FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");

        var session = trip.Sessions.FirstOrDefault(s => s.Id == sessionId)
            ?? throw new KeyNotFoundException("Receive session not found.");

        if (session.Status != "PENDING_APPROVAL")
            throw new InvalidOperationException("Only PENDING_APPROVAL sessions can be approved.");

        var sharedTotal = trip.Costs.Where(c => !c.IsPostCompletion).Sum(c => c.Amount);
        var totalItemCost = trip.Items.Sum(i => i.TotalCost);

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            foreach (var si in session.Items)
            {
                var item = trip.Items.FirstOrDefault(i => i.Id == si.PurchaseItemId)
                    ?? throw new KeyNotFoundException($"Purchase item {si.PurchaseItemId} not found.");

                var inv = await _db.BranchVariantInventories
                    .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", trip.BranchId, item.VariantId)
                    .FirstOrDefaultAsync();

                if (inv == null)
                {
                    // Pre-existing race (not introduced by branching): the read above found
                    // nothing, but a concurrent first-time receive for this exact
                    // (branch, variant) could insert between our read and our write. Try the
                    // insert; if another request beat us to it, fall back to the normal
                    // UPDLOCK-read path instead of crashing on the PK violation.
                    try
                    {
                        inv = new BranchVariantInventory { BranchId = trip.BranchId!.Value, VariantId = item.VariantId, OnHand = 0, Committed = 0, Damaged = 0 };
                        _db.BranchVariantInventories.Add(inv);
                        await _db.SaveChangesAsync();
                    }
                    catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
                    {
                        _db.Entry(inv!).State = EntityState.Detached;
                        inv = await _db.BranchVariantInventories
                            .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", trip.BranchId, item.VariantId)
                            .FirstOrDefaultAsync()
                            ?? throw new InvalidOperationException("Inventory row vanished after unique-constraint retry.");
                    }
                }

                if (si.QtyUsable > 0)
                {
                    var (allocated, landedUnit) = ComputeLandedCost(item.TotalCost, totalItemCost, sharedTotal, si.QtyUsable);

                    // Update weighted average landed cost on purchase item
                    var newLandedAvg = item.QtyUsable > 0
                        ? Math.Round((item.QtyUsable * item.LandedUnitCost + si.QtyUsable * landedUnit) / (item.QtyUsable + si.QtyUsable), 2)
                        : landedUnit;
                    item.AllocatedSharedCost += allocated;
                    item.LandedUnitCost = newLandedAvg;

                    // AvgLandedCost lives on ProductVariant (business-level, not per-branch), so
                    // the weighted average needs the variant's true on-hand across ALL branches,
                    // not just the branch this session is receiving into.
                    var globalOnHand = await _db.BranchVariantInventories.AsNoTracking()
                        .Where(x => x.VariantId == item.VariantId)
                        .SumAsync(x => x.OnHand);
                    var variant = await _db.ProductVariants.FirstOrDefaultAsync(v => v.Id == item.VariantId)!;
                    inv.OnHand += si.QtyUsable;
                    variant!.AvgLandedCost = ComputeNewAvgCost(globalOnHand, variant.AvgLandedCost, si.QtyUsable, landedUnit);

                    var lot = new Lot
                    {
                        BusinessId = trip.BusinessId,
                        BranchId = trip.BranchId,
                        VariantId = item.VariantId,
                        PurchaseItemId = item.Id,
                        QtyIn = si.QtyUsable,
                        LandedUnitCost = landedUnit,
                        PerLotValuesJson = si.PerLotValuesJson,
                        RemainingQty = si.QtyUsable
                    };
                    _db.Lots.Add(lot);
                    await _db.SaveChangesAsync();

                    _db.StockMovements.Add(new StockMovement
                    {
                        BusinessId = trip.BusinessId,
                        BranchId = trip.BranchId,
                        VariantId = item.VariantId,
                        MovementType = "PURCHASE_IN",
                        Qty = si.QtyUsable,
                        LotId = lot.Id,
                        ReferenceType = "PurchaseReceiveSession",
                        ReferenceId = session.Id,
                        UserId = userId
                    });
                }

                if (si.QtyDamaged > 0)
                {
                    inv.Damaged += si.QtyDamaged;
                    _db.StockMovements.Add(new StockMovement
                    {
                        BusinessId = trip.BusinessId,
                        BranchId = trip.BranchId,
                        VariantId = item.VariantId,
                        MovementType = "DAMAGE_IN",
                        Qty = si.QtyDamaged,
                        ReferenceType = "PurchaseReceiveSession",
                        ReferenceId = session.Id,
                        UserId = userId,
                        Note = $"Damaged on arrival ({session.SessionNo})"
                    });
                }

                // Update purchase item cumulative totals
                item.QtyUsable += si.QtyUsable;
                item.QtyDamaged += si.QtyDamaged;
                item.QtyMissing += si.QtyMissing;
            }

            session.Status = "APPROVED";
            session.ApprovedBy = userId;
            session.ApprovedAt = DateTime.UtcNow;

            // Auto-complete if all items fully received
            var allItemsFullyReceived = trip.Items.All(i =>
                i.DeletedAt == null && i.QtyUsable + i.QtyDamaged + i.QtyMissing >= i.QtyBought);
            if (allItemsFullyReceived)
            {
                trip.Status = "COMPLETED";
                trip.CompletedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            await _log.LogAsync(trip.BusinessId, userId, "UPDATE", "PurchaseReceiveSession", session.Id);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return await GetAsync(tripId);
    }

    public async Task<PurchaseTripDetailDto> RejectSessionAsync(Guid tripId, Guid sessionId, string? reason, Guid userId)
    {
        var session = await _db.PurchaseReceiveSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.TripId == tripId)
            ?? throw new KeyNotFoundException("Receive session not found.");

        if (session.Status != "PENDING_APPROVAL")
            throw new InvalidOperationException("Only PENDING_APPROVAL sessions can be rejected.");

        session.Status = "REJECTED";
        session.RejectionReason = reason;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "PurchaseReceiveSession", session.Id);
        return await GetAsync(tripId);
    }

    // ── Close trip ────────────────────────────────────────────────────────────

    public async Task<PurchaseTripDetailDto> CloseTripAsync(Guid tripId, string? forceCloseReason, Guid userId)
    {
        var trip = await _db.PurchaseTrips
            .Include(t => t.Items)
            .Include(t => t.Sessions)
            .FirstOrDefaultAsync(t => t.Id == tripId)
            ?? throw new KeyNotFoundException("Purchase trip not found.");

        if (trip.Status != "RECEIVING" && trip.Status != "DRAFT")
            throw new InvalidOperationException("Only RECEIVING or DRAFT trips can be closed.");

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

    private static PurchaseTripDetailDto MapDetail(PurchaseTrip t, Dictionary<Guid, VariantReturnInfo>? returnsByVariant = null) => new(
        t.Id, t.TripNo, t.SourceType, t.Status, t.Note, t.ApprovalNote,
        t.ExpectedDeliveryDate, t.SupplierPoRef,
        t.CreatedAt, t.CompletedAt, t.ForceCompleteReason,
        t.Items.Where(i => i.DeletedAt == null).Select(i => MapItem(i, returnsByVariant)).ToList(),
        t.Costs.Where(c => c.DeletedAt == null).Select(MapCost).ToList(),
        t.Sessions.Where(s => s.DeletedAt == null).OrderBy(s => s.ReceivedAt).Select(MapSession).ToList(),
        DeserializeAttachments(t.AttachmentsJson),
        t.Shipments.Where(s => s.DeletedAt == null).Select(MapShipment).FirstOrDefault()
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
            i.QtyMissing
        );
    }

    private static PurchaseTripCostDto MapCost(PurchaseTripCost c) => new(
        c.Id, c.CostType, c.Amount, c.Note, c.PhotoUrl, c.PaidBy, c.IsPostCompletion
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
            new PurchaseReceiveItemDto(i.Id, i.PurchaseItemId, i.QtyUsable, i.QtyDamaged, i.PerLotValuesJson, i.QtyMissing)
        ).ToList(),
        DeserializeAttachments(s.AttachmentsJson)
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
