using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize]
[Route("api/v1")]
public class FinancialCorrectionsController(AppDbContext db, IBusinessContext business, IActivityLogService log, ICurrentUserService user) : ControllerBase
{
    [HttpPost("expenses/{id:guid}/correction")]
    public Task<IActionResult> Expense(Guid id, FinancialCorrectionRequest request) => Correct(id, false, request);

    [HttpPost("capital-injections/{id:guid}/correction")]
    public Task<IActionResult> Installment(Guid id, FinancialCorrectionRequest request) => Correct(id, true, request);

    private async Task<IActionResult> Correct(Guid id, bool installment, FinancialCorrectionRequest request)
    {
        try {
            await new FinancialCorrectionService(db, business, log).CorrectAsync(id, installment, request, user.UserId, user.IsOwner);
            return NoContent();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
