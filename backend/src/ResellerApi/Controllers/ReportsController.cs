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

    // Contains expense amounts, so staff never receive it.
    [HttpGet("cash-activity")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> CashActivity([FromQuery] DateOnly from,[FromQuery] DateOnly to,[FromQuery] string source="CASH",[FromQuery] string direction="ALL",[FromQuery] int page=1)
    {
        try { return Ok(await _svc.GetCashActivityAsync(from,to,source,direction,page)); }
        catch(ArgumentException ex) { return BadRequest(new {message=ex.Message}); }
    }

    [HttpGet("dashboard/expense-section")]
    public async Task<IActionResult> DashboardExpenseSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardExpenseSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/money-section")]
    public async Task<IActionResult> DashboardMoneySection() => Ok(await _svc.GetDashboardMoneySectionAsync());

    [HttpGet("dashboard/collection-section")]
    public async Task<IActionResult> DashboardCollectionSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardCollectionSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/profit-section")]
    public async Task<IActionResult> DashboardProfitSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH")) return BadRequest("Invalid dashboard period.");
        if (!_user.CanSeeCosts) return Forbid();
        return Ok(await _svc.GetDashboardProfitSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/orders-section")]
    public async Task<IActionResult> DashboardOrdersSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardOrdersSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/products-section")]
    public async Task<IActionResult> DashboardProductsSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardProductsSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/capital-section")]
    [Authorize(Roles = Roles.OwnerOrPartner)]
    public async Task<IActionResult> DashboardCapitalSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardCapitalSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/dues-section")]
    public async Task<IActionResult> DashboardDuesSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardDuesSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/top-section")]
    public async Task<IActionResult> DashboardTopSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardTopSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/counter-section")]
    public async Task<IActionResult> DashboardCounterSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardCounterSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/transit-section")]
    public async Task<IActionResult> DashboardTransitSection([FromQuery] string period = "MONTH")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH" or "ALL")) return BadRequest("Invalid dashboard period.");
        return Ok(await _svc.GetDashboardTransitSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/sales-section")]
    public async Task<IActionResult> DashboardSalesSection([FromQuery] string period = "TODAY")
    {
        if (period is not ("TODAY" or "YESTERDAY" or "7D" or "MONTH")) return BadRequest("Invalid sales period.");
        return Ok(await _svc.GetDashboardSalesSectionAsync(_user.CanSeeCosts, period));
    }

    [HttpGet("dashboard/sales-overview")]
    public async Task<IActionResult> DashboardSalesOverview() => Ok(await _svc.GetDashboardSalesOverviewAsync(_user.CanSeeCosts));

    [HttpGet("dashboard/expense-summary")]
    public async Task<IActionResult> DashboardExpenseSummary() => Ok(await _svc.GetDashboardExpenseSummaryAsync());

    [HttpGet("dashboard/today-expense")]
    public async Task<IActionResult> DashboardTodayExpense() => Ok(await _svc.GetDashboardTodayExpenseAsync());

    [HttpGet("dashboard/financial-summary")]
    public async Task<IActionResult> DashboardFinancialSummary() => Ok(await _svc.GetDashboardFinancialSummaryAsync(_user.CanSeeCosts));

    [HttpGet("dashboard/order-summary")]
    public async Task<IActionResult> DashboardOrderSummary() => Ok(await _svc.GetDashboardOrderSummaryAsync());

    [HttpGet("dashboard/collections-summary")]
    public async Task<IActionResult> DashboardCollectionsSummary() => Ok(await _svc.GetDashboardCollectionsSummaryAsync());

    [HttpGet("dashboard/today-sales") ]
    public async Task<IActionResult> DashboardTodaySales() => Ok(await _svc.GetDashboardTodaySalesAsync());

    [HttpGet("dashboard/today-orders") ]
    public async Task<IActionResult> DashboardTodayOrders() => Ok(await _svc.GetDashboardTodayOrdersAsync());

    [HttpGet("dashboard/today-returns") ]
    public async Task<IActionResult> DashboardTodayReturns() => Ok(await _svc.GetDashboardTodayReturnsAsync());

    [HttpGet("dashboard/stock") ]
    public async Task<IActionResult> DashboardStock() => Ok(await _svc.GetDashboardStockAsync());

    [HttpGet("dashboard/collections") ]
    public async Task<IActionResult> DashboardGetSalesCollections() => Ok(await _svc.GetSalesCollectionsAsync());

    [HttpGet("dashboard/due") ]
    public async Task<IActionResult> DashboardDue() => Ok(await _svc.GetDashboardDueAsync());

    [HttpGet("dashboard/trend") ]
    public async Task<IActionResult> DashboardTrend() => Ok(await _svc.GetDashboardTrendAsync());

    [HttpGet("dashboard/top-products") ]
    public async Task<IActionResult> DashboardTopProducts() => Ok(await _svc.GetDashboardTopProductsAsync());

    [HttpGet("dashboard/payment-methods") ]
    public async Task<IActionResult> DashboardPaymentMethods() => Ok(await _svc.GetDashboardPaymentMethodsAsync());

    [HttpGet("dashboard/categories") ]
    public async Task<IActionResult> DashboardCategories() => Ok(await _svc.GetDashboardCategoriesAsync());

    [HttpGet("dashboard/today-profit")]
    public async Task<IActionResult> DashboardTodayProfit()
        => _user.CanSeeCosts ? Ok(await _svc.GetDashboardTodayProfitAsync()) : Forbid();

    [HttpGet("home-summary")]
    public async Task<IActionResult> HomeSummary()
        => Ok(await _svc.GetHomeSummaryAsync(_user.CanSeeCosts));

    [HttpGet("home-today-metrics")]
    public async Task<IActionResult> HomeTodayMetrics()
        => Ok(await _svc.GetHomeTodayMetricsAsync(_user.CanSeeCosts));

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

    [HttpGet("expense-categories")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> ExpenseHistoryCategories()
    {
        var categories = await _db.ExpenseCategories.AsNoTracking().Select(c => new { c.Id, c.Name }).ToListAsync();
        categories.AddRange(ExpenseHistory.Categories.Select(c => new { Id = c.Key, Name = c.Value }));
        return Ok(categories);
    }

    [HttpGet("expenses")]
    [Authorize(Roles = Roles.OwnerOrManager)]
    public async Task<IActionResult> Expenses(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] Guid? categoryId, [FromQuery] string? status, [FromQuery] int page = 1)
    {
        var start = (from ?? DateTime.UtcNow.Date.AddDays(-29)).Date;
        var through = (to ?? DateTime.UtcNow.Date).Date;
        if (through < start || through == DateTime.MaxValue.Date)
            return BadRequest(new { message = "Choose a valid date range." });
        var history = await ResellerApi.Services.ExpenseHistory.LoadAllAsync(_db, start, through, categoryId);
        var statusTotals = history.GroupBy(e => e.Status)
            .Select(g => new { Status = g.Key, Count = g.Count(), Amount = g.Sum(e => e.Amount) }).ToList();
        var approved = history.Where(e => e.Status == "APPROVED").ToList();
        var categories = approved.GroupBy(e => new { e.CategoryId, e.CategoryName })
            .Select(g => new ExpenseReportCategoryDto(g.Key.CategoryId, g.Key.CategoryName, g.Sum(e => e.Amount), g.Count()))
            .OrderByDescending(x => x.Amount).ToList();
        var sourceTotals = approved.GroupBy(e => new { e.FundingSource, e.PettyCashBoxId })
            .Select(g => new { g.Key.FundingSource, g.Key.PettyCashBoxId, Amount = g.Sum(e => e.Amount), Count = g.Count() }).ToList();
        var sources = sourceTotals
            .GroupBy(x => x.FundingSource == "PERSONAL" ? "PERSONAL" :
                x.PettyCashBoxId != null ? "PETTY_CASH" : x.FundingSource == "BUSINESS" ? "BUSINESS" : x.FundingSource == "CASH" ? "CASH" : "UNSPECIFIED")
            .Select(g => new ExpenseReportFundingDto(g.Key, g.Sum(x => x.Amount), g.Sum(x => x.Count)))
            .OrderByDescending(x => x.Amount).ToList();

        var normalizedStatus = status?.Trim().ToUpperInvariant();
        if (!string.IsNullOrEmpty(normalizedStatus) && normalizedStatus != "ALL"
            && normalizedStatus != "APPROVED" && normalizedStatus != "PENDING" && normalizedStatus != "REJECTED")
            return BadRequest(new { message = "Invalid expense status." });
        var rows = history.AsEnumerable();
        if (!string.IsNullOrEmpty(normalizedStatus) && normalizedStatus != "ALL")
            rows = rows.Where(e => e.Status == normalizedStatus);
        const int pageSize = 25;
        page = Math.Max(1, page);
        var totalItems = rows.Count();
        var items = rows.OrderByDescending(e => e.ExpenseDate).ThenByDescending(e => e.CreatedAt).ThenByDescending(e => e.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(e => new ExpenseReportItemDto(e.Id, e.ExpenseDate, e.SubType, e.Title, e.CategoryName,
                e.Amount, e.Status, e.FundingSource, e.CreatedByName, e.Note, e.Source, e.TripId, e.PoNumber, e.LotId, e.LotNo, e.PayerName, e.PaidAt))
            .ToList();
        var approvedTotal = statusTotals.FirstOrDefault(x => x.Status == "APPROVED");
        var pendingTotal = statusTotals.FirstOrDefault(x => x.Status == "PENDING");
        var rejectedTotal = statusTotals.FirstOrDefault(x => x.Status == "REJECTED");
        return Ok(new ExpenseReportDto(start, through,
            approvedTotal?.Amount ?? 0, approvedTotal?.Count ?? 0,
            pendingTotal?.Amount ?? 0, pendingTotal?.Count ?? 0,
            rejectedTotal?.Amount ?? 0, rejectedTotal?.Count ?? 0,
            categories, sources, items, totalItems, page, pageSize));
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
