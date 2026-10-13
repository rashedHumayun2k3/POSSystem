using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Expenses;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;
using ResellerApi.Services;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/expenses")]
public class ExpensesController : ControllerBase
{
    private readonly IExpenseService _svc;
    private readonly ICurrentUserService _user;
    private readonly ExpenseFundingService _funding;

    public ExpensesController(IExpenseService svc, ICurrentUserService user, ExpenseFundingService funding)
    {
        _svc = svc;
        _user = user;
        _funding = funding;
    }

    [HttpGet("funding")]
    public async Task<IActionResult> Funding() => Ok(await _funding.GetAsync(_user.UserId, _user.IsOwner, _user.CanSeeCosts || _user.IsPartner));

    [HttpPost("funding/opening-balance")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> InitializeFunding(InitializeExpenseFundRequest request)
    {
        try
        {
            await _funding.InitializeAsync(request.OpeningBalance, _user.UserId);
            return Ok(await _funding.GetAsync(_user.UserId, true, true));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] Guid? categoryId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30)
    {
        var result = await _svc.ListAsync(new ExpenseListRequest(status, categoryId, from, to, page, pageSize));
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        try { return Ok(await _svc.GetAsync(id)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExpenseRequest req)
    {
        try
        {
            bool isOwner = User.IsInRole(Roles.Owner);
            var result = await _svc.CreateAsync(req, _user.UserId, isOwner);
            return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateExpenseRequest req)
    {
        try { return Ok(await _svc.UpdateAsync(id, req, _user.UserId)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try { await _svc.DeleteAsync(id, _user.UserId); return NoContent(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveExpenseRequest req)
    {
        try { return Ok(await _svc.ApproveAsync(id, _user.UserId, req.Note)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectExpenseRequest req)
    {
        try { return Ok(await _svc.RejectAsync(id, _user.UserId, req.Reason)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
