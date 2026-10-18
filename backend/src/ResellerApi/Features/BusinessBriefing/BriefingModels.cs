namespace ResellerApi.Features.BusinessBriefing;

public record BriefingPreferences(string TimeZone = "Asia/Dhaka", int BusinessDayCutoffHour = 0,
    string Address = "", bool ReligiousGreeting = false, string DefaultMode = "standard", double SpeakingRate = 0.9);
public record BriefingPeriod(DateOnly Date, bool PeriodEnded, string Label);
public record BriefingMetrics(decimal Sales, int Orders, int DeliveredFromPeriod, int PendingDeliveries,
    int LowStockVariants, int OutOfStockVariants, int MyOverdueTasks, decimal ApprovedMonthExpenses, decimal? PreviousSales, string? TopProduct = null);
public record BriefingSegment(string Id, string Text);
public record BriefingReport(int Version, DateTime AsOf, string TimeZone, string Scope, BriefingPeriod Period,
    string Mode, string Currency, BriefingMetrics Metrics, IReadOnlyList<BriefingSegment> Segments,
    string Transcript, IReadOnlyList<string> Notices);
