using System.Globalization;
namespace ResellerApi.Features.BusinessBriefing;

public static class BanglaNarrative
{
    private static readonly string[] Small = ("শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো তেরো চৌদ্দ পনেরো ষোলো সতেরো আঠারো উনিশ বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আটাশ ঊনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ ঊনচল্লিশ চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ ঊনপঞ্চাশ পঞ্চাশ একান্ন বাহান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন ঊনষাট ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি ঊনসত্তর সত্তর একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর ঊনআশি আশি একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি ঊননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই").Split(' ');
    public static string Number(long n)
    {
        if (n < 0) return "ঋণাত্মক " + Number(-n);
        if (n < 100) return Small[n];
        foreach (var (unit, word) in new[] { (10000000L, "কোটি"), (100000L, "লাখ"), (1000L, "হাজার"), (100L, "শো") })
            if (n >= unit) return Number(n / unit) + " " + word + (n % unit == 0 ? "" : " " + Number(n % unit));
        return "";
    }
    public static string Money(decimal value)
    {
        var rounded = decimal.Round(value, 2, MidpointRounding.AwayFromZero);
        var amount = decimal.Abs(rounded);
        var taka = (long)decimal.Truncate(amount);
        var paisa = (long)((amount - taka) * 100);
        return (rounded < 0 ? "ঋণাত্মক " : "") + Number(taka) + " টাকা" + (paisa > 0 ? " " + Number(paisa) + " পয়সা" : "");
    }
    public static BriefingPeriod Period(DateTime utc, BriefingPreferences settings)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(settings.TimeZone));
        var businessDate = DateOnly.FromDateTime(local.AddHours(-settings.BusinessDayCutoffHour));
        var morning = local.Hour >= 5 && local.Hour < 12;
        var date = morning ? businessDate.AddDays(-1) : businessDate;
        var label = date.ToDateTime(TimeOnly.MinValue).ToString("dddd", CultureInfo.GetCultureInfo("bn-BD")) + ", " + Number(date.Day) + " " + date.ToDateTime(TimeOnly.MinValue).ToString("MMMM", CultureInfo.GetCultureInfo("bn-BD")) + " " + Number(date.Year);
        return new(date, morning, label + (morning ? " দিনের হিসাব" : " দিনের এখন পর্যন্ত হিসাব"));
    }
    public static string Greeting(DateTime utc, BriefingPreferences settings)
    {
        var hour = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(settings.TimeZone)).Hour;
        var greeting = hour switch { >= 5 and < 12 => "শুভ সকাল", >= 12 and < 16 => "শুভ দুপুর", >= 16 and < 18 => "শুভ বিকেল", >= 18 and < 22 => "শুভ সন্ধ্যা", _ => "শুভ রাত্রি" };
        return (settings.ReligiousGreeting ? "আসসালামু আলাইকুম। " : "") + greeting + (string.IsNullOrWhiteSpace(settings.Address) ? "। " : ", " + settings.Address + "। ") + "আপনার ব্যবসার খবরগুলো দেখে নিচ্ছি।";
    }
    public static List<BriefingSegment> Compose(BriefingMetrics m, BriefingPeriod period, string scope, string mode)
    {
        var segments = new List<BriefingSegment> { new("period", scope + "। " + period.Label + " জানাচ্ছি।") };
        if (m.OutOfStockVariants > 0) segments.Add(new("stockout", "আগে স্টকের একটি খবর বলি। " + Number(m.OutOfStockVariants) + "টি পণ্যের ভ্যারিয়েন্টে বিক্রির উপযোগী স্টক নেই।"));
        segments.Add(new("sales", "নথিভুক্ত বিক্রি " + Money(m.Sales) + "। এই হিসাবে ছাড় বাদ দেওয়া হয়েছে, ডেলিভারি চার্জ যোগ করা হয়েছে। ফেরত ও রিফান্ড বাদ দেওয়া হয়নি।"));
        if (m.PreviousSales > 0 && period.PeriodEnded)
        {
            var percent = decimal.Round((m.Sales - m.PreviousSales.Value) / m.PreviousSales.Value * 100, 0, MidpointRounding.AwayFromZero);
            segments.Add(new("comparison", percent == 0 ? "আগের দিনের তুলনায় বিক্রি প্রায় একই আছে।" : "আগের দিনের তুলনায় বিক্রি প্রায় " + Number((long)decimal.Abs(percent)) + " শতাংশ " + (percent > 0 ? "বেড়েছে।" : "কমেছে।")));
        }
        segments.Add(new("orders", "এই দিনের " + Number(m.Orders) + "টি বাতিল না হওয়া অর্ডারের মধ্যে " + Number(m.DeliveredFromPeriod) + "টি এখন পর্যন্ত ডেলিভারি হয়েছে।"));
        if (m.PendingDeliveries > 0) segments.Add(new("delivery", "আগের দিনগুলোসহ সব মিলিয়ে " + Number(m.PendingDeliveries) + "টি অর্ডারের ডেলিভারি বাকি আছে।"));
        if (mode != "quick")
        {
            if (!string.IsNullOrWhiteSpace(m.TopProduct) && m.TopProduct.Length <= 60 && !m.TopProduct.Any(char.IsControl))
                segments.Add(new("product", "অর্ডারের পরিমাণ অনুযায়ী সবচেয়ে বেশি বিক্রি হয়েছে " + m.TopProduct + "।"));
            if (m.LowStockVariants > 0) segments.Add(new("stock", Number(m.LowStockVariants) + "টি পণ্যের ভ্যারিয়েন্টে স্টক নির্ধারিত সীমায় বা তার নিচে আছে।"));
            if (m.MyOverdueTasks > 0) segments.Add(new("tasks", "এই ব্যবসায় আপনার নিজের " + Number(m.MyOverdueTasks) + "টি কাজের নির্ধারিত সময় পেরিয়ে গেছে।"));
            segments.Add(new("expenses", "এই মাসে এখন পর্যন্ত নির্বাচিত পরিসরে অনুমোদিত খরচ " + Money(m.ApprovedMonthExpenses) + "।"));
        }
        if (mode == "detailed") segments.Add(new("definition", "বিক্রি অর্ডারে লেখা ব্যবসার তারিখ অনুযায়ী গণনা করা হয়েছে। স্টক ও বাকি ডেলিভারির তথ্য বর্তমান অবস্থার। এটি লাভ বা হাতে পাওয়া নগদ টাকার হিসাব নয়।"));
        var actions = new List<string>();
        if (m.OutOfStockVariants > 0 || m.LowStockVariants > 0) actions.Add("স্টক তালিকা দেখে প্রয়োজনীয় পণ্য আনার ব্যবস্থা করুন");
        if (m.PendingDeliveries > 0) actions.Add("বাকি ডেলিভারিগুলোর অগ্রগতি দেখে নিন");
        if (m.MyOverdueTasks > 0) actions.Add("সময় পেরিয়ে যাওয়া কাজগুলো দেখে নিন");
        if (actions.Count > 0) segments.Add(new("actions", "এরপর " + string.Join("। ", actions.Take(mode == "quick" ? 1 : 3)) + "।"));
        return segments;
    }
}
