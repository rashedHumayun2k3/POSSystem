using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.Infrastructure;

namespace ResellerApi.Features.BusinessBriefing;

[ApiController]
[Authorize(Roles = Roles.OwnerOrManager)]
[Route("api/v1/business-briefing")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class BriefingController(BriefingService service) : ControllerBase
{
    [HttpGet("preferences")]
    public async Task<IActionResult> Preferences(CancellationToken ct)
    {
        try { var p = await service.Preferences(ct); return Ok(new { preferences = p, greeting = BanglaNarrative.Greeting(DateTime.UtcNow, p) }); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
    }
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string mode = "standard", CancellationToken ct = default)
    {
        try { return Ok(await service.Generate(mode, DateTime.UtcNow, ct)); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
    }
}
