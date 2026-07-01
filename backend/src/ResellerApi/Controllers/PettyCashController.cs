using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Expenses;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.Owner)]
[Route("api/v1/petty-cash")]
public class PettyCashController : ControllerBase
{
    private readonly IPettyCashService _svc;
    private readonly ICurrentUserService _user;

    public PettyCashController(IPettyCashService svc, ICurrentUserService user)
    {
        _svc = svc;
        _user = user;
    }

    [HttpGet("boxes")]
    public async Task<IActionResult> ListBoxes()
        => Ok(await _svc.ListBoxesAsync());

    [HttpGet("boxes/{id:guid}")]
    public async Task<IActionResult> GetBox(Guid id)
    {
        try { return Ok(await _svc.GetBoxAsync(id)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("boxes/for-staff/{staffId:guid}")]
    public async Task<IActionResult> GetOrCreateForStaff(Guid staffId)
    {
        try { return Ok(await _svc.GetOrCreateBoxForStaffAsync(staffId, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("boxes/{id:guid}/fund")]
    public async Task<IActionResult> Fund(Guid id, [FromBody] FundPettyCashRequest req)
    {
        try { return Ok(await _svc.FundAsync(id, req, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("boxes/{id:guid}/adjust")]
    public async Task<IActionResult> Adjust(Guid id, [FromBody] AdjustPettyCashRequest req)
    {
        try { return Ok(await _svc.AdjustAsync(id, req, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("boxes/{id:guid}/txns")]
    public async Task<IActionResult> ListTxns(Guid id, [FromQuery] int limit = 50)
    {
        try { return Ok(await _svc.ListTxnsAsync(id, limit)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }
}
