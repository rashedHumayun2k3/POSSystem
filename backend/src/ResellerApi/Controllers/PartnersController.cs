using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Partners;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

// Module 15 (Partnership & Capital Ledger), sub-phase 15a.
// Owner-only on every route — GTR-10 / R15.10: capital/profit data is exactly what STAFF must
// never see, and partners themselves use a separate portal (sub-phase 15e), not this controller.
[ApiController]
[Authorize(Roles = Roles.Owner)]
[Route("api/v1/partners")]
public class PartnersController : ControllerBase
{
    private readonly IPartnerService _partners;
    private readonly IPartnerCapitalService _capital;
    private readonly ICurrentUserService _user;

    public PartnersController(IPartnerService partners, IPartnerCapitalService capital, ICurrentUserService user)
    {
        _partners = partners;
        _capital = capital;
        _user = user;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? partnerType, [FromQuery] string? status)
        => Ok(await _partners.ListAsync(partnerType, status));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        try { return Ok(await _partners.GetAsync(id)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePartnerRequest request)
    {
        try
        {
            var result = await _partners.CreateAsync(request, _user.UserId);
            return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePartnerRequest request)
    {
        try { return Ok(await _partners.UpdateAsync(id, request, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpGet("{id:guid}/balance")]
    public async Task<IActionResult> GetBalance(Guid id)
    {
        try { return Ok(await _capital.GetBalanceAsync(id)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpGet("{id:guid}/ledger")]
    public async Task<IActionResult> GetLedger(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        => Ok(await _capital.ListLedgerAsync(id, from, to));

    [HttpGet("{id:guid}/capital-injections")]
    public async Task<IActionResult> ListInjections(Guid id)
        => Ok(await _capital.ListInjectionsAsync(id));

    [HttpPost("{id:guid}/capital-injections")]
    public async Task<IActionResult> RecordInjection(Guid id, [FromBody] CreateCapitalInjectionRequest request)
    {
        try
        {
            var result = await _capital.RecordInjectionAsync(id, request, _user.UserId);
            return CreatedAtAction(nameof(ListInjections), new { id }, result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // R15.11 — new partner approval workflow.

    [HttpGet("{id:guid}/approval")]
    public async Task<IActionResult> GetApproval(Guid id)
    {
        try { return Ok(await _partners.GetApprovalStatusAsync(id)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/votes")]
    public async Task<IActionResult> CastVote(Guid id, [FromBody] CastApprovalVoteRequest request)
    {
        try { return Ok(await _partners.CastVoteAsync(id, request, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> CancelPending(Guid id, [FromBody] CancelPendingPartnerRequest request)
    {
        try { return Ok(await _partners.CancelPendingAsync(id, request, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
