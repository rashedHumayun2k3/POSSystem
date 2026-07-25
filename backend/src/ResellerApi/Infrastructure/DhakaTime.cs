namespace ResellerApi.Infrastructure;

// Bangladesh Standard Time is a fixed UTC+6 with no DST, so a plain offset is exact and
// permanent — no TimeZoneInfo/tzdata lookup needed. Used to resolve report date presets
// (এই মাস / গত মাস / etc.) against the shop's local calendar instead of raw UTC days, which
// would otherwise be off by up to 6 hours from what a Dhaka-based owner means by "this month".
public static class DhakaTime
{
    private static readonly TimeSpan Offset = TimeSpan.FromHours(6);

    public static DateTime UtcToLocal(DateTime utc) => utc + Offset;
    public static DateTime LocalToUtc(DateTime local) => local - Offset;

    public record PresetRange(DateTime FromUtc, DateTime ToExclusiveUtc, DateTime FromLocalDate, DateTime ToLocalDate, string Label);

    // `to` is exclusive (the UTC instant right after the last included local day) — ready to use
    // directly as `CreatedAt >= FromUtc && CreatedAt < ToExclusiveUtc`.
    public static PresetRange ResolvePreset(string? preset, DateTime? customFrom, DateTime? customTo)
    {
        var todayLocal = UtcToLocal(DateTime.UtcNow).Date;
        DateTime fromLocal, toLocalInclusive;
        string label;

        switch (preset)
        {
            case "last_month":
                var firstOfThisMonth = new DateTime(todayLocal.Year, todayLocal.Month, 1);
                fromLocal = firstOfThisMonth.AddMonths(-1);
                toLocalInclusive = firstOfThisMonth.AddDays(-1);
                label = "গত মাস";
                break;
            case "last_3_months":
                fromLocal = todayLocal.AddMonths(-3).AddDays(1);
                toLocalInclusive = todayLocal;
                label = "গত ৩ মাস";
                break;
            case "this_year":
                fromLocal = new DateTime(todayLocal.Year, 1, 1);
                toLocalInclusive = todayLocal;
                label = "এই বছর";
                break;
            case "custom":
                fromLocal = (customFrom ?? todayLocal).Date;
                toLocalInclusive = (customTo ?? todayLocal).Date;
                label = "কাস্টম";
                break;
            default: // "this_month"
                fromLocal = new DateTime(todayLocal.Year, todayLocal.Month, 1);
                toLocalInclusive = todayLocal;
                label = "এই মাস";
                break;
        }

        var fromUtc = LocalToUtc(fromLocal);
        var toExclusiveUtc = LocalToUtc(toLocalInclusive.AddDays(1));
        return new PresetRange(fromUtc, toExclusiveUtc, fromLocal, toLocalInclusive, label);
    }
}
