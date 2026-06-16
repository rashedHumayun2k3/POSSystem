using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/units")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly AppDbContext _db;

    public UnitsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var units = await _db.Units
            .AsNoTracking()
            .OrderBy(u => u.Name)
            .Select(u => new { u.Code, u.Name, u.AllowsDecimal })
            .ToListAsync();
        return Ok(units);
    }
}
