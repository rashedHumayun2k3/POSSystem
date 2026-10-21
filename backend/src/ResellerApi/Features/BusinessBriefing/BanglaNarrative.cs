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
        var label = businessDate.ToDateTime(TimeOnly.MinValue).ToString("dddd", CultureInfo.GetCultureInfo("bn-BD")) + ", " + Number(businessDate.Day) + " " + businessDate.ToDateTime(TimeOnly.MinValue).ToString("MMMM", CultureInfo.GetCultureInfo("bn-BD"));
        return new(businessDate, false, label);
    }
    public static string Greeting(DateTime utc, BriefingPreferences settings)
    {
        var hour = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(settings.TimeZone)).Hour;
        var greeting = hour switch { >= 5 and < 12 => "শুভ সকাল", >= 12 and < 16 => "শুভ দুপুর", >= 16 and < 18 => "শুভ বিকেল", >= 18 and < 22 => "শুভ সন্ধ্যা", _ => "শুভ রাত্রি" };
        return (settings.ReligiousGreeting ? "আসসালামু আলাইকুম। " : "") + greeting + (string.IsNullOrWhiteSpace(settings.Address) ? "। " : ", " + settings.Address + "। ") + "আপনার ব্যবসার খবরগুলো দেখে নিচ্ছি।";
    }
    public static List<BriefingSegment> Compose(BriefingMetrics m, BriefingPeriod period, string scope, string mode)
    {
        var segments = new List<BriefingSegment>();

        // Urgent stock news comes first, but is not repeated in the stock summary below.
        if (m.OutOfStockVariants > 0)
            segments.Add(new("urgent-stock", "জরুরি খবর। " + Number(m.OutOfStockVariants) + "টি পণ্যের স্টক শেষ।"));

        segments.Add(new("start", scope + "-এর আজকের হিসাব বলছি। আজ " + period.Label + "।"));
        if (m.Sales <= 0)
            segments.Add(new("sales", "এখন পর্যন্ত আজ কোনো বিক্রি হয়নি।"));
        else
        {
            var sales = "এখন পর্যন্ত " + Number(m.Orders) + "টি অর্ডারে মোট বিক্রি হয়েছে " + Money(m.Sales) + "।";
            if (m.PreviousSales.HasValue)
            {
                var difference = m.Sales - m.PreviousSales.Value;
                sales += difference == 0
                    ? " গতকালের এই সময়ের সমান বিক্রি হয়েছে।"
                    : " গতকালের এই সময়ের চেয়ে বিক্রি " + Money(decimal.Abs(difference)) + (difference > 0 ? " বেশি।" : " কম।");
            }
            segments.Add(new("sales", sales));
        }

        segments.Add(new("profit", "আজ আনুমানিক লাভ হয়েছে " + Money(m.Profit) + "।"));

        var collection = new List<string>();
        if (m.CashReceived > 0) collection.Add("নগদ পেয়েছেন " + Money(m.CashReceived));
        if (m.MobileReceived > 0) collection.Add("বিকাশ-নগদে এসেছে " + Money(m.MobileReceived));
        if (collection.Count > 0) segments.Add(new("collection", string.Join(", ", collection) + "।"));
        if (m.CreditSales > 0) segments.Add(new("credit-sales", "আজ বাকিতে বিক্রি হয়েছে " + Money(m.CreditSales) + "।"));
        if (m.CustomerDue > 0) segments.Add(new("customer-due", "কাস্টমারদের কাছে মোট বাকি আছে " + Money(m.CustomerDue) + "।"));
        if (m.SupplierDue > 0) segments.Add(new("supplier-due", "সাপ্লায়ারদের দিতে হবে " + Money(m.SupplierDue) + "।"));

        if (m.PendingDeliveries > 0) segments.Add(new("pending", Number(m.PendingDeliveries) + "টি অর্ডার এখনো ডেলিভারি হয়নি।"));
        if (m.CancelledOrders > 0) segments.Add(new("cancelled", Number(m.CancelledOrders) + "টি অর্ডার বাতিল হয়েছে।"));
        if (m.ReturnedOrders > 0)
            segments.Add(new("returned", Number(m.ReturnedOrders) + "টি পণ্য ফেরত এসেছে" + (m.RefundedAmount > 0 ? ", ফেরত দিয়েছেন " + Money(m.RefundedAmount) : "") + "।"));

        if (m.LowStockVariants > 0) segments.Add(new("low-stock", "আরও " + Number(m.LowStockVariants) + "টি পণ্যের স্টক কমে গেছে।"));
        if (!string.IsNullOrWhiteSpace(m.TopProduct) && m.TopProduct.Length <= 60 && !m.TopProduct.Any(char.IsControl))
            segments.Add(new("top-product", "আজ সবচেয়ে বেশি বিক্রি হয়েছে " + m.TopProduct + "।"));

        var expenseLines = new List<string>
        {
            m.TodayExpenses > 0 ? "আজ খরচ হয়েছে " + Money(m.TodayExpenses) : "আজ কোনো খরচ হয়নি",
            m.YesterdayExpenses > 0 ? "গতকাল খরচ হয়েছিল " + Money(m.YesterdayExpenses) : "গতকাল কোনো খরচ হয়নি"
        };
        if (m.WeekExpenses > 0) expenseLines.Add("এই সপ্তাহে এখন পর্যন্ত খরচ " + Money(m.WeekExpenses));
        if (period.Date.Day != 1 && m.MonthExpenses > 0) expenseLines.Add("এ মাসে এখন পর্যন্ত মোট খরচ " + Money(m.MonthExpenses));
        segments.Add(new("expenses", string.Join("। ", expenseLines) + "।"));

        if (m.OutOfStockVariants > 0 || m.LowStockVariants > 0)
            segments.Add(new("closing", "স্টক দেখে দরকারি পণ্যগুলো আনিয়ে নিন।"));
        return segments;
    }
}
