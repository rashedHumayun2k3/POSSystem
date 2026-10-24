using Microsoft.EntityFrameworkCore;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Entities;

namespace ResellerApi.Services;

public partial class PurchaseTripService
{
    private static void ValidateReceipt(PurchaseTrip trip, PurchaseReceiveSession session)
    {
        if (!ApprovedPurchase(trip)) throw new InvalidOperationException("Receiving requires an approved, open PO. Draft receiving is not allowed.");
        if (session.Items.Count == 0 || session.Items.Select(i => i.PurchaseItemId).Distinct().Count() != session.Items.Count)
            throw new ArgumentException("Receive each product line exactly once.");
        PurchaseShipment? lot = null;
        if (session.ShipmentId.HasValue)
        {
            lot = trip.Shipments.SingleOrDefault(s => s.Id == session.ShipmentId && !s.IsLegacy)
                ?? throw new ArgumentException("Lot does not belong to this PO.");
            if (lot.Status != "SENT" || trip.Status is not ("IN_PROGRESS" or "RECEIVING"))
                throw new InvalidOperationException("Only sent lots on an in-progress PO can be received.");
            if (trip.Sessions.Any(s => s.Id != session.Id && s.ShipmentId == lot.Id && s.Status != "REJECTED"))
                throw new InvalidOperationException("This lot already has a pending or approved receipt.");
            if (lot.Items.Count != session.Items.Count) throw new ArgumentException("Account for every product in this lot.");
        }
        else if (trip.UsesShipmentLots) throw new ArgumentException("Choose a sent lot before receiving.");

        foreach (var line in session.Items)
        {
            var product = trip.Items.SingleOrDefault(i => i.Id == line.PurchaseItemId)
                ?? throw new ArgumentException("Received product does not belong to this PO.");
            ValidateSessionItemQty(product, line.QtyUsable, line.QtyDamaged, line.QtyMissing);
            var accounted = line.QtyUsable + line.QtyDamaged + line.QtyMissing;
            if (new[] {line.QtyUsable, line.QtyDamaged, line.QtyMissing}.Any(q => Math.Round(q, 3) != q))
                throw new ArgumentException("Quantities support at most three decimal places.");
            if (lot != null)
            {
                var expected = lot.Items.SingleOrDefault(i => i.PurchaseItemId == line.PurchaseItemId)?.Qty;
                if (expected != accounted) throw new ArgumentException("Usable + damaged + missing must equal the quantity assigned to the lot.");
                ValidateWeight(line.MeasuredWeightGrams);
                if (line.QtyUsable + line.QtyDamaged > 0 && line.MeasuredWeightGrams <= 0)
                    throw new ArgumentException("Enter the total measured weight for each physically received product.");
                if (line.QtyUsable + line.QtyDamaged == 0 && line.MeasuredWeightGrams != 0)
                    throw new ArgumentException("A completely missing product must have zero measured weight.");
            }
            else
            {
                // Legacy receipts may only use quantity not reserved by a newer lot or another pending receipt.
                var otherPending = trip.Sessions.Where(s => s.Id != session.Id && s.ShipmentId == null && s.Status == "PENDING_APPROVAL")
                    .SelectMany(s => s.Items).Where(i => i.PurchaseItemId == product.Id).Sum(i => i.QtyUsable + i.QtyDamaged + i.QtyMissing);
                var lotReserved = trip.Shipments.Where(s => !s.IsLegacy && s.Status != "RECEIVED").SelectMany(s => s.Items)
                    .Where(i => i.PurchaseItemId == product.Id).Sum(i => i.Qty);
                if (accounted + otherPending + lotReserved + product.QtyUsable + product.QtyDamaged + product.QtyMissing > product.QtyBought)
                    throw new ArgumentException("Quantity is already reserved by another receipt or lot.");
            }
        }
    }

    private static List<PurchaseLotCosting.Line> ReceiptCosts(PurchaseTrip trip, PurchaseReceiveSession session)
    {
        if (session.ShipmentId.HasValue && !trip.Costs.Any(c =>
                c.ShipmentId == session.ShipmentId &&
                (c.CostType == "SHIPPING_INTL" || c.CostType == "COURIER") &&
                !c.IsPostCompletion))
            throw new InvalidOperationException("Assign a shipping company and add its shipping cost before approving this lot.");
        var common = trip.Costs.Where(c => c.ShipmentId == null && !c.IsPostCompletion).Sum(c => c.Amount);
        var lotCosts = session.ShipmentId.HasValue ? trip.Costs.Where(c => c.ShipmentId == session.ShipmentId && !c.IsPostCompletion).Sum(c => c.Amount) : 0;
        return PurchaseLotCosting.Allocate(trip.Items.ToList(), session.Items.ToList(), common, lotCosts, session.ShipmentId.HasValue);
    }

    public async Task<PurchaseTripDetailDto> CreateReceiveSessionAsync(Guid tripId, CreateReceiveSessionRequest request, Guid userId, bool isOwner)
    {
        await using var tx = await new ExpenseFundingService(_db, _business).BeginAsync();
        var trip = await LoadLotTripAsync(tripId);
        var mode = request.TransportMode.ToUpperInvariant();
        if (!ValidTransportModes.Contains(mode)) throw new ArgumentException("Invalid transport mode.");
        var attachments = request.Attachments ?? [];
        ValidateAttachments(attachments);
        ValidateWeight(request.BilledWeightGrams);
        var session = new PurchaseReceiveSession
        {
            BusinessId = trip.BusinessId, BranchId = trip.BranchId, TripId = tripId, ShipmentId = request.ShipmentId,
            SessionNo = await GenerateSessionNoAsync(tripId), ReceivedBy = userId, ReceivedAt = request.ReceivedAt,
            TransportMode = mode, VehicleOrTrackingNo = request.VehicleOrTrackingNo, Note = request.Note,
            AttachmentsJson = System.Text.Json.JsonSerializer.Serialize(attachments),
            Items = request.Items.Select(i => new PurchaseReceiveItem { PurchaseItemId = i.PurchaseItemId,
                QtyUsable = i.QtyUsable, QtyDamaged = i.QtyDamaged, QtyMissing = i.QtyMissing,
                MeasuredWeightGrams = i.MeasuredWeightGrams, PerLotValuesJson = i.PerLotValuesJson }).ToList()
        };
        ValidateReceipt(trip, session);
        if (request.ShipmentId.HasValue)
        {
            var lot = trip.Shipments.Single(s => s.Id == request.ShipmentId);
            lot.BilledWeightGrams = request.BilledWeightGrams;
        }
        if (isOwner) ReceiptCosts(trip, session); // Fail before persisting an auto-approved receipt.
        trip.Sessions.Add(session);
        _db.PurchaseReceiveSessions.Add(session);
        if (isOwner) await ApplyReceiptAsync(trip, session, userId);
        await _db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        await _log.LogAsync(trip.BusinessId, userId, "CREATE", "PurchaseReceiveSession", session.Id);
        return await GetAsync(tripId);
    }

    public async Task<CompleteTripPreviewDto> PreviewSessionAsync(Guid tripId, Guid sessionId)
    {
        var trip = await LoadLotTripAsync(tripId);
        var session = trip.Sessions.SingleOrDefault(s => s.Id == sessionId) ?? throw new KeyNotFoundException("Receive session not found.");
        if (session.Status != "PENDING_APPROVAL") throw new InvalidOperationException("Only pending receipts can be previewed.");
        ValidateReceipt(trip, session);
        var costs = ReceiptCosts(trip, session);
        var previews = new List<LandedCostPreviewDto>();
        foreach (var line in session.Items)
        {
            var product = trip.Items.Single(i => i.Id == line.PurchaseItemId);
            var cost = costs.Single(c => c.ItemId == product.Id);
            var oldQty = await _db.BranchVariantInventories.IgnoreQueryFilters()
                .Where(i => i.VariantId == product.VariantId).SumAsync(i => i.OnHand);
            previews.Add(new(product.Id, product.Variant?.Product?.Name ?? "", product.Variant?.Sku ?? "", line.QtyUsable,
                product.TotalCost / product.QtyBought * (line.QtyUsable + line.QtyDamaged), cost.AllocatedCost,
                cost.LandedUnitCost, product.Variant?.AvgLandedCost ?? 0,
                ComputeNewAvgCost(oldQty, product.Variant?.AvgLandedCost ?? 0, line.QtyUsable, cost.LandedUnitCost)));
        }
        return new(costs.Sum(c => c.AllocatedCost), previews);
    }

    public async Task<PurchaseTripDetailDto> ApproveSessionAsync(Guid tripId, Guid sessionId, Guid userId)
    {
        await using var tx = await new ExpenseFundingService(_db, _business).BeginAsync();
        var trip = await LoadLotTripAsync(tripId);
        var session = trip.Sessions.SingleOrDefault(s => s.Id == sessionId) ?? throw new KeyNotFoundException("Receive session not found.");
        if (session.Status != "PENDING_APPROVAL") throw new InvalidOperationException("Only pending receipts can be approved.");
        ValidateReceipt(trip, session);
        await ApplyReceiptAsync(trip, session, userId);
        await _db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        await _log.LogAsync(trip.BusinessId, userId, "UPDATE", "PurchaseReceiveSession", session.Id);
        return await GetAsync(tripId);
    }

    private async Task ApplyReceiptAsync(PurchaseTrip trip, PurchaseReceiveSession session, Guid userId)
    {
        var costs = ReceiptCosts(trip, session);
        foreach (var line in session.Items)
        {
            var item = trip.Items.Single(i => i.Id == line.PurchaseItemId);
            var cost = costs.Single(c => c.ItemId == item.Id);
            line.AllocatedShippingCost = cost.AllocatedCost;
            line.LossAmount = cost.LossAmount;
            var variant = item.Variant ?? throw new InvalidOperationException("Product variant is unavailable.");
            if (session.ShipmentId.HasValue && line.QtyUsable + line.QtyDamaged > 0)
            {
                variant.UnitWeightGrams = Math.Round(line.MeasuredWeightGrams / (line.QtyUsable + line.QtyDamaged), 3);
                item.UnitWeightGrams = variant.UnitWeightGrams;
            }
            // Orders and stock adjustments also mutate this row. Preserve the existing SQL update lock.
            var inventory = _db.Database.IsSqlServer()
                ? await _db.BranchVariantInventories.FromSqlInterpolated($"SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE BranchId = {trip.BranchId} AND VariantId = {item.VariantId}").FirstOrDefaultAsync()
                : await _db.BranchVariantInventories.FirstOrDefaultAsync(i => i.BranchId == trip.BranchId && i.VariantId == item.VariantId);
            if (inventory == null)
            {
                inventory = new BranchVariantInventory { BranchId = trip.BranchId!.Value, VariantId = item.VariantId };
                _db.BranchVariantInventories.Add(inventory);
            }
            if (line.QtyUsable > 0)
            {
                var globalQty = await _db.BranchVariantInventories.IgnoreQueryFilters().Where(i => i.VariantId == item.VariantId).SumAsync(i => i.OnHand);
                item.LandedUnitCost = ComputeNewAvgCost(item.QtyUsable, item.LandedUnitCost, line.QtyUsable, cost.LandedUnitCost);
                variant.AvgLandedCost = ComputeNewAvgCost(globalQty, variant.AvgLandedCost, line.QtyUsable, cost.LandedUnitCost);
                inventory.OnHand += line.QtyUsable;
                var lot = new Lot { BusinessId = trip.BusinessId, BranchId = trip.BranchId, VariantId = item.VariantId,
                    PurchaseItemId = item.Id, QtyIn = line.QtyUsable, RemainingQty = line.QtyUsable,
                    LandedUnitCost = cost.LandedUnitCost, PerLotValuesJson = line.PerLotValuesJson };
                _db.Lots.Add(lot);
                _db.StockMovements.Add(new StockMovement { BusinessId = trip.BusinessId, BranchId = trip.BranchId,
                    VariantId = item.VariantId, MovementType = "PURCHASE_IN", Qty = line.QtyUsable, LotId = lot.Id,
                    ReferenceType = "PurchaseReceiveSession", ReferenceId = session.Id, UserId = userId });
            }
            if (line.QtyDamaged > 0)
            {
                inventory.Damaged += line.QtyDamaged;
                _db.StockMovements.Add(new StockMovement { BusinessId = trip.BusinessId, BranchId = trip.BranchId,
                    VariantId = item.VariantId, MovementType = "DAMAGE_IN", Qty = line.QtyDamaged,
                    ReferenceType = "PurchaseReceiveSession", ReferenceId = session.Id, UserId = userId, Note = $"Damaged on arrival ({session.SessionNo})" });
            }
            item.AllocatedSharedCost += cost.AllocatedCost;
            item.QtyUsable += line.QtyUsable; item.QtyDamaged += line.QtyDamaged; item.QtyMissing += line.QtyMissing;
            if (session.ShipmentId == null) item.QtyShipped = Math.Max(item.QtyShipped, item.QtyUsable + item.QtyDamaged + item.QtyMissing);
            // Flush inside the transaction so another line of the same variant sees the updated stock.
            await _db.SaveChangesAsync();
        }
        session.Status = "APPROVED"; session.ApprovedBy = userId; session.ApprovedAt = DateTime.UtcNow;
        if (session.ShipmentId.HasValue)
        {
            var lot = trip.Shipments.Single(s => s.Id == session.ShipmentId);
            lot.Status = "RECEIVED"; lot.MeasuredWeightGrams = session.Items.Sum(i => i.MeasuredWeightGrams);
        }
        if (trip.Items.Count > 0 && trip.Items.All(i => i.QtyUsable + i.QtyDamaged + i.QtyMissing == i.QtyBought)
            && !trip.Sessions.Any(s => s.Id != session.Id && s.Status == "PENDING_APPROVAL"))
        { trip.Status = "COMPLETED"; trip.CompletedAt = DateTime.UtcNow; }
        else trip.Status = "IN_PROGRESS";
    }
}
