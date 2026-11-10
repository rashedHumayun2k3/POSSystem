using System.Text.RegularExpressions;

namespace ResellerApi.Data;

public static class DashboardReportSql
{
    public static string[] Batches(string resource = "DashboardReports.sql")
    {
        using var stream = typeof(DashboardReportSql).Assembly.GetManifestResourceStream("ResellerApi.Data.Sql." + resource)
            ?? throw new InvalidOperationException("Dashboard procedure resource is missing.");
        using var reader = new StreamReader(stream);
        return Regex.Split(reader.ReadToEnd(), @"^GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase)
            .Where(sql => !string.IsNullOrWhiteSpace(sql)).ToArray();
    }
}
