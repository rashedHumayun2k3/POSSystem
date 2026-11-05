using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Expenses;

namespace ResellerApi.Services;

// Read-only projection: payments remain in their original ledger and are never posted as new expenses.
public static class ExpenseHistory
{
    public static readonly Guid ProductsCategory = Guid.Parse("eeeeeeee-0000-0000-0000-000000000001");
    public static readonly Guid ShippingCategory = Guid.Parse("eeeeeeee-0000-0000-0000-000000000002");
    public static readonly Guid TransportCategory = Guid.Parse("eeeeeeee-0000-0000-0000-000000000003");
    public static readonly Guid OtherCategory = Guid.Parse("eeeeeeee-0000-0000-0000-000000000004");
    public static readonly Dictionary<Guid, string> Categories = new()
    {
        [ProductsCategory] = "PO Product Purchase", [ShippingCategory] = "PO Shipping Cost",
        [TransportCategory] = "PO Transport Cost", [OtherCategory] = "PO Other Costs"
    };

    public static IQueryable<ExpenseHistoryRow> Purchases(AppDbContext db) =>
        from p in db.PurchasePayments.AsNoTracking().Where(p => p.BusinessId == db.CurrentBusinessId && p.DeletedAt == null
            && (db.CurrentBranchId == null || p.BranchId == db.CurrentBranchId))
        join trip in db.PurchaseTrips on p.TripId equals trip.Id
        join c in db.PurchaseTripCosts on p.CostKey equals c.Id into costs
        from cost in costs.DefaultIfEmpty()
        select new ExpenseHistoryRow
        {
            Id = p.Id, Amount = p.Amount, Status = "APPROVED", Source = "PURCHASE_PAYMENT",
            // Purchase payment timestamps are UTC; expense filters use Bangladesh calendar dates.
            ExpenseDate = p.PaidAt.AddHours(6).Date, PaidAt = p.PaidAt, CreatedAt = p.CreatedAt,
            CategoryId = cost == null ? ProductsCategory : cost.CostType == "SHIPPING_INTL" || cost.CostType == "COURIER" ? ShippingCategory : cost.CostType == "TRANSPORT" ? TransportCategory : OtherCategory,
            CategoryName = cost == null ? "PO Product Purchase" : cost.CostType == "SHIPPING_INTL" || cost.CostType == "COURIER" ? "PO Shipping Cost" : cost.CostType == "TRANSPORT" ? "PO Transport Cost" : "PO Other Costs",
            SubType = cost == null ? "PO Product Purchase" : cost.CostType == "SHIPPING_INTL" || cost.CostType == "COURIER" ? "PO Shipping Cost" : cost.CostType == "TRANSPORT" ? "PO Transport Cost" : "PO " + cost.CostType + " Cost",
            Title = cost == null ? "PO Product Purchase" : cost.CostType == "SHIPPING_INTL" || cost.CostType == "COURIER" ? "PO Shipping Cost" : cost.CostType == "TRANSPORT" ? "PO Transport Cost" : "PO " + cost.CostType + " Cost",
            Note = cost == null ? null : cost.Note, FundingSource = p.FundingSource,
            CreatedBy = p.CreatedBy,
            CreatedByName = db.Users.IgnoreQueryFilters().Where(u => u.Id == p.CreatedBy).Select(u => u.Name).FirstOrDefault() ?? "Unknown user",
            PayerName = (p.FundingSource == "PERSONAL" ? db.Partners.IgnoreQueryFilters().Where(x => x.Id == p.PartnerId && x.BusinessId == p.BusinessId).Select(x => x.Name).FirstOrDefault() : null)
                ?? db.Users.IgnoreQueryFilters().Where(u => u.Id == p.CreatedBy).Select(u => u.Name).FirstOrDefault(),
            TripId = trip.Id, PoNumber = trip.TripNo, PurchaseCostId = cost == null ? null : cost.Id,
            PhotoUrl = cost == null ? null : cost.PhotoUrl, LotId = cost == null ? null : cost.ShipmentId,
            LotNo = cost == null ? null : db.PurchaseShipments.Where(l => l.Id == cost.ShipmentId && l.TripId == trip.Id).Select(l => l.LotNo).FirstOrDefault(),
            PettyCashBoxId = null
        };

    public static IQueryable<ExpenseHistoryRow> All(AppDbContext db) => db.Expenses.AsNoTracking()
        .Where(e => e.BusinessId == db.CurrentBusinessId && e.DeletedAt == null && (db.CurrentBranchId == null || e.BranchId == db.CurrentBranchId))
        .Select(e => new ExpenseHistoryRow
    {
        Id = e.Id, Amount = e.Amount, Status = e.Status, Source = "EXPENSE", ExpenseDate = e.ExpenseDate,
        PaidAt = e.PaidAt, CreatedAt = e.CreatedAt, CategoryId = e.CategoryId, CategoryName = e.Category.Name,
        SubType = e.SubType, Title = e.Title, Note = e.Note, FundingSource = e.FundingSource,
        CreatedBy = e.CreatedBy, CreatedByName = e.CreatedByUser.Name,
        PayerName = e.FundingPartnerName ?? e.CreatedByUser.Name, TripId = null, PoNumber = null, LotId = null, LotNo = null,
        PettyCashBoxId = e.PettyCashBoxId
    }).Concat(Purchases(db));

    // Keep the expense-list query portable.  The original all-in-one projection contains a
    // left join plus correlated user/partner lookups, which SQL Server can reject depending on
    // the database schema/version.  These are small, indexed lookups and are only requested
    // when the caller asks to include PO payments.
    public static async Task<List<ExpenseHistoryRow>> LoadPurchasesAsync(
        AppDbContext db, DateTime? from = null, DateTime? to = null, Guid? categoryId = null)
    {
        var payments = await db.PurchasePayments.IgnoreQueryFilters().AsNoTracking()
            .Where(p => p.BusinessId == db.CurrentBusinessId && p.DeletedAt == null &&
                (db.CurrentBranchId == null || p.BranchId == db.CurrentBranchId))
            .ToListAsync();

        var tripIds = payments.Select(p => p.TripId).Distinct().ToList();
        var costIds = payments.Where(p => p.CostKey != Guid.Empty).Select(p => p.CostKey).Distinct().ToList();
        var userIds = payments.Select(p => p.CreatedBy).Distinct().ToList();
        var partnerIds = payments.Where(p => p.PartnerId.HasValue).Select(p => p.PartnerId!.Value).Distinct().ToList();

        var trips = await db.PurchaseTrips.IgnoreQueryFilters().AsNoTracking()
            .Where(t => tripIds.Contains(t.Id) && t.BusinessId == db.CurrentBusinessId)
            .ToDictionaryAsync(t => t.Id);
        var costs = await db.PurchaseTripCosts.IgnoreQueryFilters().AsNoTracking()
            .Where(c => costIds.Contains(c.Id) && tripIds.Contains(c.TripId))
            .ToDictionaryAsync(c => c.Id);
        var lotIds = costs.Values.Where(c => c.ShipmentId.HasValue).Select(c => c.ShipmentId!.Value).Distinct().ToList();
        var lots = await db.PurchaseShipments.IgnoreQueryFilters().AsNoTracking()
            .Where(l => lotIds.Contains(l.Id)).ToDictionaryAsync(l => l.Id);
        var users = await db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);
        var partners = await db.Partners.IgnoreQueryFilters().AsNoTracking()
            .Where(p => partnerIds.Contains(p.Id) && p.BusinessId == db.CurrentBusinessId)
            .ToDictionaryAsync(p => p.Id, p => p.Name);

        var rows = payments.Where(p => trips.ContainsKey(p.TripId)).Select(p =>
        {
            costs.TryGetValue(p.CostKey, out var cost);
            var isShipping = cost?.CostType is "SHIPPING_INTL" or "COURIER";
            var isTransport = cost?.CostType == "TRANSPORT";
            var id = cost == null ? ProductsCategory : isShipping ? ShippingCategory : isTransport ? TransportCategory : OtherCategory;
            var name = Categories[id];
            lots.TryGetValue(cost?.ShipmentId ?? Guid.Empty, out var lot);
            users.TryGetValue(p.CreatedBy, out var creator);
            var payer = p.FundingSource == "PERSONAL" && p.PartnerId.HasValue && partners.TryGetValue(p.PartnerId.Value, out var partner)
                ? partner : creator;
            return new ExpenseHistoryRow
            {
                Id = p.Id, Amount = p.Amount, Status = "APPROVED", Source = "PURCHASE_PAYMENT",
                ExpenseDate = p.PaidAt.AddHours(6).Date, PaidAt = p.PaidAt, CreatedAt = p.CreatedAt,
                CategoryId = id, CategoryName = name, SubType = name, Title = name, Note = cost?.Note,
                FundingSource = p.FundingSource, CreatedBy = p.CreatedBy, CreatedByName = creator ?? "Unknown user",
                PayerName = payer, TripId = p.TripId, PoNumber = trips[p.TripId].TripNo,
                PurchaseCostId = cost?.Id, PhotoUrl = cost?.PhotoUrl,
                LotId = cost?.ShipmentId, LotNo = lot?.LotNo
            };
        });
        if (from.HasValue) rows = rows.Where(r => r.ExpenseDate >= from.Value.Date);
        if (to.HasValue) rows = rows.Where(r => r.ExpenseDate <= to.Value.Date);
        if (categoryId.HasValue) rows = rows.Where(r => r.CategoryId == categoryId.Value);
        return rows.ToList();
    }

    public static async Task<List<ExpenseHistoryRow>> LoadAllAsync(
        AppDbContext db, DateTime? from = null, DateTime? to = null, Guid? categoryId = null)
    {
        var expenses = await db.Expenses.AsNoTracking()
            .Include(e => e.Category).Include(e => e.CreatedByUser)
            .Where(e => e.BusinessId == db.CurrentBusinessId && e.DeletedAt == null &&
                (db.CurrentBranchId == null || e.BranchId == db.CurrentBranchId))
            .ToListAsync();
        var rows = expenses.Select(e => new ExpenseHistoryRow
        {
            Id = e.Id, Amount = e.Amount, Status = e.Status, Source = "EXPENSE", ExpenseDate = e.ExpenseDate,
            PaidAt = e.PaidAt, CreatedAt = e.CreatedAt, CategoryId = e.CategoryId, CategoryName = e.Category.Name,
            SubType = e.SubType, Title = e.Title, Note = e.Note, FundingSource = e.FundingSource,
            CreatedBy = e.CreatedBy, CreatedByName = e.CreatedByUser?.Name ?? "Unknown user",
            PayerName = e.FundingPartnerName ?? e.CreatedByUser?.Name, PettyCashBoxId = e.PettyCashBoxId
        }).ToList();
        rows.AddRange(await LoadPurchasesAsync(db, from, to, categoryId));
        if (from.HasValue) rows = rows.Where(r => r.ExpenseDate >= from.Value.Date).ToList();
        if (to.HasValue) rows = rows.Where(r => r.ExpenseDate <= to.Value.Date).ToList();
        if (categoryId.HasValue) rows = rows.Where(r => r.CategoryId == categoryId.Value).ToList();
        return rows;
    }

    public static ExpenseDto ToExpense(ExpenseHistoryRow p) => new(
        p.Id, p.CategoryId, p.CategoryName, p.SubType, p.Amount, p.ExpenseDate, null, null, false, null,
        p.TripId, null, p.PhotoUrl, p.Status, p.PaidAt, p.CreatedBy, p.CreatedByName, null, null, p.Note, null, p.CreatedAt,
        p.FundingSource, p.PayerName, UpdatedAt: p.CreatedAt, IsAccountingPeriodClosed: true)
    { Title = p.Title, Source = p.Source, TripId = p.TripId, PoNumber = p.PoNumber, LotId = p.LotId, LotNo = p.LotNo, PayerName = p.PayerName, PurchaseCostId = p.PurchaseCostId };
}

public class ExpenseHistoryRow
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string CategoryName { get; set; } = "";
    public string SubType { get; set; } = "";
    public string? Title { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = "";
    public string Source { get; set; } = "";
    public DateTime ExpenseDate { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public string CreatedByName { get; set; } = "";
    public string? Note { get; set; }
    public string? FundingSource { get; set; }
    public string? PayerName { get; set; }
    public Guid? PurchaseCostId { get; set; }
    public string? PhotoUrl { get; set; }
    public Guid? TripId { get; set; }
    public string? PoNumber { get; set; }
    public Guid? LotId { get; set; }
    public string? LotNo { get; set; }
    public Guid? PettyCashBoxId { get; set; }
}
