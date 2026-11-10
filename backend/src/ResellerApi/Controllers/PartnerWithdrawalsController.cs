using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.Owner)]
[Route("api/v1/partner-withdrawals")]
public sealed class PartnerWithdrawalsController(PartnerWithdrawalService service, ICurrentUserService user) : ControllerBase
{
    [HttpGet("form")]
    public async Task<IActionResult> Form() => Ok(await service.FormAsync(user.UserId));

    [HttpGet]
    public async Task<IActionResult> List() => Ok(await service.ListAsync());

    [HttpPost]
    public async Task<IActionResult> Create(CreateWithdrawalRequest request)
    {
        try { return Ok(await service.WithdrawAsync(request, user.UserId)); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
        catch (KeyNotFoundException e) { return NotFound(new { message = e.Message }); }
        catch (InvalidOperationException e) { return Conflict(new { message = e.Message }); }
    }
}
