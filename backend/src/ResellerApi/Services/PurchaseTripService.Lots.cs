using ClosedXML.Excel;
using System.IO.Compression;
using Microsoft.EntityFrameworkCore;
using ResellerApi.DTOs.Purchases;
using ResellerApi.Entities;

namespace ResellerApi.Services;

public partial class PurchaseTripService
{
    // Internal catalog onboarding only; this is not an HTTP endpoint or a supplier purchase approval.
    public async Task PrepareOpeningStockAsync(Guid tripId, Guid userId)
    {
        var trip = await _db.PurchaseTrips.SingleAsync(t => t.Id == tripId);
        if (trip.SourceType != "OPENING_BALANCE" || trip.Status != "DRAFT")
            throw new InvalidOperationException("Only a new opening-stock record can use this operation.");
        trip.Status = "IN_PROGRESS"; trip.UsesShipmentLots = false; trip.ApprovedBy = userId;
        await _db.SaveChangesAsync();
    }

    private async Task ValidateCostScopeAsync(PurchaseTrip trip, Guid? shipmentId, string costType, bool postCompletion)
    {
        if (shipmentId.HasValue)
        {
            var lot = await _db.PurchaseShipments.FirstOrDefaultAsync(s => s.Id == shipmentId && s.TripId == trip.Id && !s.IsLegacy)
                ?? throw new ArgumentException("Lot does not belong to this PO.");
            if (lot.Status == "RECEIVED" && !postCompletion) throw new InvalidOperationException("Received lot costs are locked.");
        }
        else
        {
            if (costType is "CHINA_LOCAL" or "COURIER") throw new ArgumentException("Select a lot for China local or courier costs.");
            if (trip.Status is not ("DRAFT" or "PENDING_APPROVAL") && !postCompletion)
                throw new InvalidOperationException("Common costs are locked after product approval.");
        }
    }

    private async Task<PurchaseTrip> LoadLotTripAsync(Guid id) =>
        await _db.PurchaseTrips.Include(t => t.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product)
            .Include(t => t.Costs).Include(t => t.Shipments).ThenInclude(s => s.Items)
            .Include(t => t.Sessions).ThenInclude(s => s.Items)
            .FirstOrDefaultAsync(t => t.Id == id) ?? throw new KeyNotFoundException("Purchase not found.");

    private static bool ApprovedPurchase(PurchaseTrip trip) => trip.Status is "PRODUCT_APPROVED" or "IN_PROGRESS" or "RECEIVING";

    private static decimal Reserved(PurchaseTrip trip, Guid itemId, Guid? excluding = null) =>
        trip.Shipments.Where(s => !s.IsLegacy && s.DeletedAt == null && s.Id != excluding)
            .SelectMany(s => s.Items).Where(i => i.DeletedAt == null && i.PurchaseItemId == itemId).Sum(i => i.Qty)
        + trip.Sessions.Where(s => s.ShipmentId == null && s.Status != "REJECTED" && s.DeletedAt == null)
            .SelectMany(s => s.Items).Where(i => i.PurchaseItemId == itemId && i.DeletedAt == null)
            .Sum(i => i.QtyUsable + i.QtyDamaged + i.QtyMissing);

    private static void ValidateLotItems(PurchaseTrip trip, List<ShipmentItemInput> items, Guid? excluding = null)
    {
        if (items.Count == 0 || items.Count > 500) throw new ArgumentException("A lot needs between 1 and 500 product lines.");
        if (items.Select(i => i.PurchaseItemId).Distinct().Count() != items.Count)
            throw new ArgumentException("Combine duplicate product lines before saving the lot.");
        foreach (var input in items)
        {
            var product = trip.Items.SingleOrDefault(i => i.Id == input.PurchaseItemId)
                ?? throw new ArgumentException("A product does not belong to this PO.");
            if (input.Qty <= 0 || decimal.Round(input.Qty, 3) != input.Qty)
                throw new ArgumentException("Lot quantity must be positive with at most three decimal places.");
            if (input.Qty + Reserved(trip, product.Id, excluding) > product.QtyBought)
                throw new InvalidOperationException($"{product.Variant?.Sku}: lot quantity exceeds the unallocated quantity.");
        }
    }

    public async Task<PurchaseLotDto> SaveLotAsync(Guid tripId, Guid? lotId, SavePurchaseLotRequest request, Guid userId)
    {
        await using var tx = await new ExpenseFundingService(_db, _business).BeginAsync();
        var trip = await LoadLotTripAsync(tripId);
        if (!ApprovedPurchase(trip)) throw new InvalidOperationException("Approve product payment before creating lots.");
        var number = request.LotNo.Trim();
        if (number.Length is < 1 or > 40) throw new ArgumentException("Lot number must be 1–40 characters.");
        ValidateWeight(request.DeclaredWeightGrams);
        if (request.DeclaredWeightGrams == 0) throw new ArgumentException("Enter the representative's declared total lot weight.");
        if (trip.Shipments.Any(s => s.Id != lotId && s.LotNo.Equals(number, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Lot number already exists on this PO.");
        var lot = lotId == null ? new PurchaseShipment { TripId = tripId } :
            trip.Shipments.SingleOrDefault(s => s.Id == lotId && !s.IsLegacy) ?? throw new KeyNotFoundException("Lot not found.");
        if (lot.Status != "READY") throw new InvalidOperationException("Only ready lots can be edited.");
        ValidateLotItems(trip, request.Items, lotId);
        lot.LotNo = number; lot.DeclaredWeightGrams = request.DeclaredWeightGrams;
        lot.TrackingNumber = request.TrackingNumber; lot.Note = request.Note;
        if (lotId == null) _db.PurchaseShipments.Add(lot);
        // Update in place: avoids collisions with the unique (ShipmentId, PurchaseItemId) index.
        foreach (var old in lot.Items.Where(i => i.DeletedAt == null).ToList())
        {
            var input = request.Items.SingleOrDefault(i => i.PurchaseItemId == old.PurchaseItemId);
            if (input == null) old.DeletedAt = DateTime.UtcNow;
            else old.Qty = input.Qty;
        }
        foreach (var input in request.Items.Where(i => !lot.Items.Any(x => x.DeletedAt == null && x.PurchaseItemId == i.PurchaseItemId)))
        {
            var line = new PurchaseShipmentItem { ShipmentId = lot.Id, PurchaseItemId = input.PurchaseItemId, Qty = input.Qty };
            lot.Items.Add(line);
            _db.PurchaseShipmentItems.Add(line);
        }
        await _db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        await _log.LogAsync(trip.BusinessId, userId, "UPDATE", "PurchaseShipment", lot.Id);
        return MapLot(lot);
    }

    public async Task<PurchaseTripDetailDto> SendLotAsync(Guid tripId, Guid lotId, SendPurchaseLotRequest request, Guid userId)
    {
        await using var tx = await new ExpenseFundingService(_db, _business).BeginAsync();
        var trip = await LoadLotTripAsync(tripId);
        if (!ApprovedPurchase(trip)) throw new InvalidOperationException("PO must be approved before sending a lot.");
        var lot = trip.Shipments.SingleOrDefault(s => s.Id == lotId && !s.IsLegacy) ?? throw new KeyNotFoundException("Lot not found.");
        if (lot.Status != "READY") throw new InvalidOperationException("Only ready lots can be sent.");
        ValidateLotItems(trip, lot.Items.Where(i => i.DeletedAt == null).Select(i => new ShipmentItemInput(i.PurchaseItemId, i.Qty)).ToList(), lot.Id);
        lot.Status = "SENT"; lot.ShippedDate = request.ShippedDate ?? DateTime.UtcNow;
        foreach (var line in lot.Items.Where(i => i.DeletedAt == null)) trip.Items.Single(i => i.Id == line.PurchaseItemId).QtyShipped += line.Qty;
        trip.Status = "IN_PROGRESS";
        await _db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        await _log.LogAsync(trip.BusinessId, userId, "UPDATE", "PurchaseShipment", lot.Id);
        return await GetAsync(tripId);
    }

    private static void ValidateWeight(decimal weight)
    {
        if (weight < 0 || weight > 99999999999.999m || decimal.Round(weight, 3) != weight)
            throw new ArgumentException("Weight must be non-negative grams with at most three decimal places.");
    }

    private PurchaseLotDto MapLot(PurchaseShipment lot) => new(lot.Id, lot.LotNo, lot.Status, lot.ShippedDate,
        lot.DeclaredWeightGrams, lot.MeasuredWeightGrams, lot.BilledWeightGrams, lot.TrackingNumber, lot.Note,
        lot.Items.Where(i => i.DeletedAt == null).Select(i => new PurchaseLotItemDto(i.PurchaseItemId, i.Qty)).ToList(),
        lot.Status == "RECEIVED" ? PurchaseLotCosting.WeightWarnings(lot.DeclaredWeightGrams, lot.MeasuredWeightGrams,
            lot.BilledWeightGrams, _weightTolerancePercent) : []);

    public async Task<LotImportPreview> PreviewLotImportAsync(Guid tripId, LotImportUpload upload)
    {
        var trip = await LoadLotTripAsync(tripId);
        if (!ApprovedPurchase(trip)) throw new InvalidOperationException("Approve the PO before importing a lot.");
        if (!upload.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) || upload.Base64.Length > 7_000_000)
            throw new ArgumentException("Choose an .xlsx file of at most 5 MB.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(upload.Base64); }
        catch (FormatException) { throw new ArgumentException("Invalid Excel upload."); }
        if (bytes.Length == 0 || bytes.Length > 5 * 1024 * 1024) throw new ArgumentException("Excel file must be 1 byte to 5 MB.");
        try
        {
            using var stream = new MemoryStream(bytes);
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Read, true))
                if (zip.Entries.Count > 500 || zip.Entries.Sum(e => e.Length) > 20 * 1024 * 1024 ||
                    zip.Entries.Any(e => e.FullName.EndsWith("vbaProject.bin", StringComparison.OrdinalIgnoreCase)))
                    throw new ArgumentException("Workbook is too large or contains macros.");
            stream.Position = 0;
            using var workbook = new XLWorkbook(stream);
            var sheet = workbook.Worksheets.First();
            var headers = sheet.Row(1).CellsUsed().ToDictionary(c => c.GetString().Trim().ToLowerInvariant(), c => c.Address.ColumnNumber);
            var qtyCol = headers.GetValueOrDefault("qty", headers.GetValueOrDefault("quantity"));
            var skuCol = headers.GetValueOrDefault("variant", headers.GetValueOrDefault("sku"));
            var nameCol = headers.GetValueOrDefault("product", headers.GetValueOrDefault("product name"));
            if (qtyCol == 0 || (skuCol == 0 && nameCol == 0)) throw new ArgumentException("Use columns Product / Variant (SKU) / Qty. At least Product or Variant is required.");
            var last = sheet.LastRowUsed()?.RowNumber() ?? 1;
            if (last > 501) throw new ArgumentException("Import at most 500 rows.");
            var rows = new List<LotImportRow>();
            var used = new Dictionary<Guid, decimal>();
            for (var n = 2; n <= last; n++)
            {
                string Read(int col) => col == 0 ? "" : sheet.Cell(n, col).GetFormattedString().Trim();
                var name = Read(nameCol); var sku = Read(skuCol); var qtyText = Read(qtyCol);
                if (name.Length + sku.Length + qtyText.Length == 0) continue;
                string? error = null;
                var matches = trip.Items.Where(i => sku.Length > 0 ? string.Equals(i.Variant?.Sku, sku, StringComparison.OrdinalIgnoreCase)
                    : string.Equals(i.Variant?.Product?.Name, name, StringComparison.OrdinalIgnoreCase)).ToList();
                var item = matches.Count == 1 ? matches[0] : null;
                if (item == null) error = matches.Count == 0 ? "Unknown product / variant in this PO." : "Ambiguous product; use a unique variant SKU or manual entry.";
                if (sheet.Row(n).CellsUsed().Any(c => c.HasFormula)) error = "Paste values instead of formulas.";
                if (!decimal.TryParse(qtyText, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var qty) || qty <= 0 || decimal.Round(qty, 3) != qty)
                    error = "Enter a positive quantity with at most three decimal places.";
                if (item != null)
                {
                    used[item.Id] = used.GetValueOrDefault(item.Id) + Math.Max(0, qty);
                    if (used[item.Id] + Reserved(trip, item.Id) > item.QtyBought) error = "Quantity exceeds remaining unallocated quantity.";
                }
                rows.Add(new(n, name, sku, qty, item?.Id, error));
            }
            return new(rows, rows.Count > 0 && rows.All(r => r.Error == null));
        }
        catch (Exception ex) when (ex is not ArgumentException)
        { throw new ArgumentException("Unable to read this workbook. Use a standard .xlsx file with Product, Variant and Qty columns."); }
    }
}
