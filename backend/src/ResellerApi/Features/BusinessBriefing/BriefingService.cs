using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Features.BusinessBriefing;

public sealed class BriefingService(AppDbContext db, ICurrentUserService user)
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
        // BusinessDate is the home dashboard's authoritative date (including backdated entries).
        // Bounded pages preserve the shared financial rounding exactly without loading all orders.
        async Task<(decimal Sales, int Count, int Delivered)> Totals(DateOnly date)
        {
            decimal sales = 0; int count = 0, delivered = 0;
            var query = db.Orders.AsNoTracking().Where(o => o.BusinessDate == date && !o.IsDraft && o.OrderStatus != "CANCELLED");
            for (var skip = 0; ; skip += 500)
            {
                var rows = await query.OrderBy(o => o.Id).Skip(skip).Take(500)
                    .Include(o => o.Items.Where(i => i.DeletedAt == null)).ToListAsync(ct);
                foreach (var row in rows) { sales += OrderFinancials.ComputeOrderRevenue(row); count++; if (row.FulfillmentStatus == "DELIVERED") delivered++; }
                if (rows.Count < 500) break;
            }
            return (sales, count, delivered);
        }
        var totals = await Totals(period.Date);
        // Timestamped historical snapshots are unavailable: never compare today's partial total to yesterday's full total.
        decimal? previous = period.PeriodEnded ? (await Totals(period.Date.AddDays(-1))).Sales : null;
        var pending = await db.Orders.CountAsync(o => !o.IsDraft && o.OrderStatus != "CANCELLED" &&
            (o.FulfillmentStatus == "UNFULFILLED" || o.FulfillmentStatus == "PACKED" || o.FulfillmentStatus == "IN_TRANSIT"), ct);
        var stock = db.ProductVariants.AsNoTracking().Where(v => v.Product.DeletedAt == null && v.Product.Status == "ACTIVE")
            .Select(v => new { Threshold = v.Product.LowStockThreshold, Available = db.BranchVariantInventories
                .Where(i => i.VariantId == v.Id && (db.CurrentBranchId == null || i.BranchId == db.CurrentBranchId))
                .Sum(i => (decimal?)(i.OnHand - i.Committed - i.Damaged)) ?? 0 });
        var low = await stock.CountAsync(x => x.Available > 0 && x.Available <= x.Threshold, ct);
        var outOfStock = await stock.CountAsync(x => x.Available <= 0, ct);
        // Tasks have business scope only; narrate only the caller's assigned tasks, explicitly labelled.
        var tasks = await db.WorkTasks.CountAsync(x => x.AssigneeId == user.UserId &&
            (x.Status == "TODO" || x.Status == "IN_PROGRESS") && x.DueAt < now, ct);
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(p.TimeZone));
        var month = new DateTime(local.Year, local.Month, 1);
        var nextDay = local.Date.AddDays(1);
        var expenses = await db.Expenses.Where(x => x.Status == "APPROVED" && x.ExpenseDate >= month && x.ExpenseDate < nextDay).SumAsync(x => (decimal?)x.Amount, ct) ?? 0;
        var topProduct = await db.OrderItems.AsNoTracking().Where(i => i.DeletedAt == null)
            .Join(db.Orders.Where(o => o.BusinessDate == period.Date && !o.IsDraft && o.OrderStatus != "CANCELLED"), i => i.OrderId, o => o.Id, (i, o) => i)
            .GroupBy(i => new { i.Variant.ProductId, i.Variant.Product.Name })
            .Select(g => new { g.Key.Name, Quantity = g.Sum(i => i.Qty) })
            .Where(x => x.Quantity > 0).OrderByDescending(x => x.Quantity).ThenBy(x => x.Name)
            .Select(x => x.Name).FirstOrDefaultAsync(ct);
        var metrics = new BriefingMetrics(totals.Sales, totals.Count, totals.Delivered, pending, low, outOfStock, tasks, expenses, previous, topProduct);
        var segments = BanglaNarrative.Compose(metrics, period, scope, mode);
        var notices = new List<string> { "বিক্রিতে ফেরত ও রিফান্ড বাদ দেওয়া হয়নি; ডেলিভারি চার্জ অন্তর্ভুক্ত।",
            "দিন বন্ধের নিশ্চিত তথ্য নেই। আগের দিনের হিসাব পরেও সংশোধিত হতে পারে।",
            "এই রিপোর্ট তৈরির সময়ের তথ্য দেখানো হচ্ছে।" };
        if (!period.PeriodEnded) notices.Add("একই সময়ের আগের দিনের সংরক্ষিত তথ্য নেই, তাই বিক্রির শতাংশ তুলনা দেখানো হয়নি।");
        if (db.CurrentBranchId.HasValue) notices.Add("শাখায় বরাদ্দ না করা ব্যবসার সাধারণ খরচ এখানে অন্তর্ভুক্ত নয়। নিজের কাজের সংখ্যা পুরো ব্যবসার।");
        return new(1, DateTime.SpecifyKind(now, DateTimeKind.Utc), p.TimeZone, scope, period, mode, business.Currency,
            metrics, segments, string.Join("\n\n", segments.Select(x => x.Text)), notices);
    }
}
