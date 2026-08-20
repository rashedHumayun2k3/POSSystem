using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Reports;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/reports")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _svc;
    private readonly ICurrentUserService _user;
    private readonly IEmailSender _emailSender;
    private readonly AppDbContext _db;

    public ReportsController(IReportService svc, ICurrentUserService user, IEmailSender emailSender, AppDbContext db)
    {
        _svc = svc;
        _user = user;
        _emailSender = emailSender;
        _db = db;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
        => Ok(await _svc.GetDashboardAsync(_user.CanSeeCosts));

    [HttpGet("home-summary")]
    public async Task<IActionResult> HomeSummary()
        => Ok(await _svc.GetHomeSummaryAsync(_user.CanSeeCosts));

    [HttpGet("sales")]
    public async Task<IActionResult> Sales(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string groupBy = "day")
    {
        var f = from ?? DateTime.UtcNow.Date.AddDays(-29);
        var t = to ?? DateTime.UtcNow.Date;
        return Ok(await _svc.GetSalesSummaryAsync(f, t, groupBy));
    }

    [HttpGet("inventory")]
    public async Task<IActionResult> Inventory(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string groupBy = "day")
    {
        var f = from ?? DateTime.UtcNow.Date.AddDays(-29);
        var t = to ?? DateTime.UtcNow.Date;
        return Ok(await _svc.GetInventoryReportAsync(f, t, groupBy, _user.CanSeeCosts));
    }

    [HttpGet("financial")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> Financial(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string groupBy = "day")
    {
        var f = from ?? DateTime.UtcNow.Date.AddDays(-29);
        var t = to ?? DateTime.UtcNow.Date;
        return Ok(await _svc.GetPnlReportAsync(f, t, groupBy, _user.CanSeeCosts));
    }

    [HttpGet("orders")]
    public async Task<IActionResult> Orders(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string groupBy = "day")
    {
        var f = from ?? DateTime.UtcNow.Date.AddDays(-29);
        var t = to ?? DateTime.UtcNow.Date;
        return Ok(await _svc.GetOrdersReportAsync(f, t, groupBy));
    }

    [HttpGet("daily-closing")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> DailyClosing([FromQuery] DateTime? date)
    {
        var d = date?.Date ?? DhakaTime.UtcToLocal(DateTime.UtcNow).Date;
        return Ok(await _svc.GetDailyClosingReportAsync(d, _user.CanSeeCosts));
    }

    [HttpGet("daily-closing/pdf")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> DailyClosingPdf([FromQuery] DateTime? date, [FromQuery] string? lang)
    {
        var d = date?.Date ?? DhakaTime.UtcToLocal(DateTime.UtcNow).Date;
        var reportLang = ResolveLang(lang);
        var report = await _svc.GetDailyClosingReportAsync(d, _user.CanSeeCosts);
        var pdf = DailyClosingReportPdfGenerator.Generate(report, reportLang);
        return File(pdf, "application/pdf", $"daily-closing-{d:yyyy-MM-dd}.pdf");
    }

    [HttpPost("daily-closing/send")]
    [Authorize]
    public async Task<IActionResult> SendDailyClosing([FromBody] SendDailyClosingReportRequest request)
    {
        var d = request.Date?.Date ?? DhakaTime.UtcToLocal(DateTime.UtcNow).Date;
        var recipient = _user.CanSeeCosts
            ? await _db.Users.AsNoTracking()
                .Where(u => u.Id == _user.UserId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync()
            : await _db.BusinessUsers.AsNoTracking()
                .Where(bu => bu.BusinessId == _db.CurrentBusinessId && bu.User.Role == Roles.Owner && bu.User.IsActive)
                .Select(bu => bu.User.Email)
                .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(recipient))
            return BadRequest(new { message = _user.CanSeeCosts ? "Your account does not have an email address." : "The owner account does not have an email address." });

        var reportLang = ResolveLang(request.Lang);
        var report = await _svc.GetDailyClosingReportAsync(d, true);
        var pdf = DailyClosingReportPdfGenerator.Generate(report, reportLang);
        var isBn = string.Equals(reportLang, "bn", StringComparison.OrdinalIgnoreCase);
        var subject = isBn
            ? $"আজকের ক্লোজিং রিপোর্ট - {report.Date:dd MMM yyyy}"
            : $"Daily closing summary - {report.Date:dd MMM yyyy}";
        try
        {
            await _emailSender.SendEmailWithAttachmentAsync(
                recipient,
                subject,
                DailyClosingEmailTemplateRenderer.Render(report, reportLang),
                pdf,
                $"daily-closing-{report.Date:yyyy-MM-dd}.pdf",
                "application/pdf");
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Could not send the daily closing report: {ex.Message}" });
        }

        return Ok(new { message = _user.CanSeeCosts ? $"Daily closing report sent to {recipient}." : "Daily closing report sent to the owner account." });
    }

    private string ResolveLang(string? lang)
    {
        var headerLang = Request.Headers["X-App-Lang"].FirstOrDefault();
        var acceptLang = Request.Headers.AcceptLanguage.FirstOrDefault();

        if (string.Equals(lang, "bn", StringComparison.OrdinalIgnoreCase)) return "bn";
        if (string.Equals(headerLang, "bn", StringComparison.OrdinalIgnoreCase)) return "bn";
        if (acceptLang?.StartsWith("bn", StringComparison.OrdinalIgnoreCase) == true) return "bn";

        if (string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase)) return "en";
        if (string.Equals(headerLang, "en", StringComparison.OrdinalIgnoreCase)) return "en";
        return "en";
    }

    // Entirely cost/profit data end to end (buy price, stock value, potential/realized profit) —
    // restricted the same way /financial already is, rather than masking individual fields.
    [HttpGet("stock-valuation")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> StockValuation(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] Guid? categoryId,
        [FromQuery] string preset = "this_month")
    {
        var range = DhakaTime.ResolvePreset(preset, from, to);
        return Ok(await _svc.GetStockValuationReportAsync(
            range.FromUtc, range.ToExclusiveUtc, range.FromLocalDate, range.ToLocalDate, range.Label,
            categoryId));
    }

}
