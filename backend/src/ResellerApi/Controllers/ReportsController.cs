using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/reports")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _svc;
    private readonly ICurrentUserService _user;

    public ReportsController(IReportService svc, ICurrentUserService user)
    {
        _svc = svc;
        _user = user;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard()
        => Ok(await _svc.GetDashboardAsync(_user.CanSeeCosts));

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
