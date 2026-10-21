using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Services;

namespace ResellerApi.Features.BusinessBriefing;

public sealed class BriefingService(AppDbContext db)
{
    public async Task<BriefingPreferences> Preferences(CancellationToken ct)
    {
        var json = await db.AppSettings.AsNoTracking().Where(x => x.Key == "business-briefing").Select(x => x.ValueJson).FirstOrDefaultAsync(ct);
        BriefingPreferences preferences;
        try { preferences = json == null ? new() : JsonSerializer.Deserialize<BriefingPreferences>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? new(); }
        catch (JsonException) { throw new ArgumentException("ব্যবসার ব্রিফিং সেটিংস ঠিক করে আবার চেষ্টা করুন।"); }
        Validate(preferences);
        return preferences;
    }
    public static void Validate(BriefingPreferences p)
    {
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(p.TimeZone); }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException) { throw new ArgumentException("সঠিক টাইমজোন নির্বাচন করুন।"); }
        if (p.BusinessDayCutoffHour is < 0 or > 11 || p.SpeakingRate is < 0.65 or > 1.2 || p.DefaultMode is not ("quick" or "standard" or "detailed") || p.Address == null || p.Address.Length > 40)
            throw new ArgumentException("ব্রিফিং সেটিংসের মান সঠিক নয়।");
    }
    public async Task<BriefingReport> Generate(string mode, DateTime now, CancellationToken ct)
    {
        if (mode is not ("quick" or "standard" or "detailed")) throw new ArgumentException("সঠিক রিপোর্টের ধরন নির্বাচন করুন।");
        var p = await Preferences(ct);
        var business = await db.Businesses.AsNoTracking().Where(x => x.Id == db.CurrentBusinessId).Select(x => new { x.Name, x.Currency }).SingleAsync(ct);
        if (business.Currency != "BDT") throw new ArgumentException("এই বাংলা ব্রিফিং এখন শুধু বাংলাদেশি টাকার হিসাব সমর্থন করে।");
        var scope = db.CurrentBranchId.HasValue
            ? await db.Branches.Where(x => x.Id == db.CurrentBranchId).Select(x => x.Name).SingleAsync(ct)
            : "সব শাখার সম্মিলিত হিসাব";
        var period = BanglaNarrative.Period(now, p);
        var zone = TimeZoneInfo.FindSystemTimeZoneById(p.TimeZone);
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), zone);
        var todayStartUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local.Date, DateTimeKind.Unspecified), zone);
        var tomorrowStartUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local.Date.AddDays(1), DateTimeKind.Unspecified), zone);
        // BusinessDate is the home dashboard's authoritative date (including backdated entries).
        // Bounded pages preserve the shared financial rounding exactly without loading all orders.
        async Task<(decimal Sales, decimal Cogs, decimal Credit, int Count)> Totals(DateOnly date, DateTime? createdBefore = null)
        {
            decimal sales = 0, cogs = 0, credit = 0; int count = 0;
            var query = db.Orders.AsNoTracking().Where(o => o.BusinessDate == date && !o.IsDraft && o.OrderStatus != "CANCELLED");
            if (createdBefore.HasValue) query = query.Where(o => o.CreatedAt <= createdBefore.Value);
            for (var skip = 0; ; skip += 500)
            {
                var rows = await query.OrderBy(o => o.Id).Skip(skip).Take(500)
                    .Include(o => o.Items.Where(i => i.DeletedAt == null))
                    .Include(o => o.Payments.Where(x => x.DeletedAt == null)).ToListAsync(ct);
                foreach (var row in rows)
                {
                    var revenue = OrderFinancials.ComputeOrderRevenue(row);
                    sales += revenue;
                    cogs += OrderFinancials.ComputeOrderCogs(row);
                    credit += Math.Max(0, revenue - row.Payments.Sum(x => x.Amount));
                    count++;
                }
                if (rows.Count < 500) break;
            }
            return (sales, cogs, credit, count);
        }
        var totals = await Totals(period.Date);
        // Compare with the previous business date only up to the same UTC instant on that day.
        decimal? previous = (await Totals(period.Date.AddDays(-1), now.AddDays(-1))).Sales;
        var pending = await db.Orders.CountAsync(o => !o.IsDraft && o.OrderStatus != "CANCELLED" &&
            (o.FulfillmentStatus == "UNFULFILLED" || o.FulfillmentStatus == "PACKED" || o.FulfillmentStatus == "IN_TRANSIT"), ct);
        var stock = db.ProductVariants.AsNoTracking().Where(v => v.Product.DeletedAt == null && v.Product.Status == "ACTIVE")
            .Select(v => new { Threshold = v.Product.LowStockThreshold, Available = db.BranchVariantInventories
                .Where(i => i.VariantId == v.Id && (db.CurrentBranchId == null || i.BranchId == db.CurrentBranchId))
                .Sum(i => (decimal?)(i.OnHand - i.Committed - i.Damaged)) ?? 0 });
        var low = await stock.CountAsync(x => x.Available > 0 && x.Available <= x.Threshold, ct);
        var outOfStock = await stock.CountAsync(x => x.Available <= 0, ct);
        var month = new DateTime(local.Year, local.Month, 1);
        var daysSinceSaturday = ((int)local.DayOfWeek - (int)DayOfWeek.Saturday + 7) % 7;
        var week = local.Date.AddDays(-daysSinceSaturday);
        async Task<decimal> Expenses(DateTime from, DateTime to) => await db.Expenses.AsNoTracking()
            .Where(x => x.Status == "APPROVED" && x.ExpenseDate >= from && x.ExpenseDate < to)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0;
        var todayExpenses = await Expenses(local.Date, local.Date.AddDays(1));
        var yesterdayExpenses = await Expenses(local.Date.AddDays(-1), local.Date);
        var weekExpenses = await Expenses(week, local.Date.AddDays(1));
        var monthExpenses = await Expenses(month, local.Date.AddDays(1));

        var payments = await db.OrderPayments.AsNoTracking()
            .Where(x => x.DeletedAt == null && x.ReceivedAt >= todayStartUtc && x.ReceivedAt < tomorrowStartUtc &&
                !x.Order.IsDraft && x.Order.OrderStatus != "CANCELLED")
            .GroupBy(x => x.Method)
            .Select(g => new { Method = g.Key, Amount = g.Sum(x => x.Amount) }).ToListAsync(ct);
        var cash = payments.Where(x => x.Method == "CASH").Sum(x => x.Amount);
        var mobile = payments.Where(x => x.Method == "BKASH" || x.Method == "NAGAD").Sum(x => x.Amount);

        decimal customerDue = 0;
        var dueQuery = db.Orders.AsNoTracking().Where(x => !x.IsDraft && x.OrderStatus != "CANCELLED");
        for (var skip = 0; ; skip += 500)
        {
            var rows = await dueQuery.OrderBy(x => x.Id).Skip(skip).Take(500)
                .Include(x => x.Items.Where(i => i.DeletedAt == null))
                .Include(x => x.Payments.Where(payment => payment.DeletedAt == null)).ToListAsync(ct);
            customerDue += rows.Sum(x => Math.Max(0, OrderFinancials.ComputeOrderRevenue(x) - x.Payments.Sum(payment => payment.Amount)));
            if (rows.Count < 500) break;
        }
        var supplierDue = await db.PurchaseItems.AsNoTracking()
            .Where(x => x.DeletedAt == null && x.Trip.Status != "CANCELLED")
            .SumAsync(x => (decimal?)x.DueAmount, ct) ?? 0;
        var cancelled = await db.Orders.CountAsync(x => x.BusinessDate == period.Date && !x.IsDraft && x.OrderStatus == "CANCELLED", ct);
        var returnedRows = await db.Orders.AsNoTracking()
            .Where(x => x.BusinessDate == period.Date && !x.IsDraft && x.FulfillmentStatus == "RETURNED")
            .Include(x => x.Items.Where(i => i.DeletedAt == null)).ToListAsync(ct);
        var refunded = returnedRows.Where(x => x.ReturnResolution == "REFUND").Sum(OrderFinancials.ComputeOrderRevenue);
        var topProduct = await db.OrderItems.AsNoTracking().Where(i => i.DeletedAt == null)
            .Join(db.Orders.Where(o => o.BusinessDate == period.Date && !o.IsDraft && o.OrderStatus != "CANCELLED"), i => i.OrderId, o => o.Id, (i, o) => i)
            .GroupBy(i => new { i.Variant.ProductId, i.Variant.Product.Name })
            .Select(g => new { g.Key.Name, Quantity = g.Sum(i => i.Qty) })
            .Where(x => x.Quantity > 0).OrderByDescending(x => x.Quantity).ThenBy(x => x.Name)
            .Select(x => x.Name).FirstOrDefaultAsync(ct);
        var metrics = new BriefingMetrics(totals.Sales, totals.Count, totals.Sales - totals.Cogs - todayExpenses,
            cash, mobile, totals.Credit, customerDue, supplierDue, pending, cancelled, returnedRows.Count, refunded,
            low, outOfStock, todayExpenses, yesterdayExpenses, weekExpenses, monthExpenses, previous, topProduct);
        var segments = BanglaNarrative.Compose(metrics, period, scope, mode);
        var notices = new List<string> { "বিক্রিতে ফেরত ও রিফান্ড বাদ দেওয়া হয়নি; ডেলিভারি চার্জ অন্তর্ভুক্ত।",
            "দিন বন্ধের নিশ্চিত তথ্য নেই। আগের দিনের হিসাব পরেও সংশোধিত হতে পারে।",
            "এই রিপোর্ট তৈরির সময়ের তথ্য দেখানো হচ্ছে।" };
        if (db.CurrentBranchId.HasValue) notices.Add("শাখায় বরাদ্দ না করা ব্যবসার সাধারণ খরচ এখানে অন্তর্ভুক্ত নয়। নিজের কাজের সংখ্যা পুরো ব্যবসার।");
        return new(1, DateTime.SpecifyKind(now, DateTimeKind.Utc), p.TimeZone, scope, period, mode, business.Currency,
            metrics, segments, string.Join("\n\n", segments.Select(x => x.Text)), notices);
    }
}
