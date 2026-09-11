using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Remittances;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/remittances")]
[Authorize]
public class RemittancesController : ControllerBase
{
    private readonly IRemittanceService _svc;
    private readonly ICurrentUserService _user;

    public RemittancesController(IRemittanceService svc, ICurrentUserService user)
    {
        _svc = svc;
        _user = user;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary() =>
        Ok(await _svc.GetSummaryAsync());

    [HttpGet("courier/{courierId:guid}/orders")]
    public async Task<IActionResult> CourierOrders(Guid courierId, [FromQuery] string? status) =>
        Ok(await _svc.GetCourierOrdersAsync(courierId, status));

    [HttpGet]
    public async Task<IActionResult> List() =>
        Ok(await _svc.ListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRemittanceRequest request)
    {
        var result = await _svc.CreateAsync(request, _user.UserId);
        return Ok(result);
    }
}
