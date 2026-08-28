using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.Owner)]
[Route("api/v1/website")]
public class WebsiteController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _businessContext;
    private readonly IStorefrontExportService _exportService;

    public WebsiteController(AppDbContext db, IBusinessContext businessContext, IStorefrontExportService exportService)
    {
        _db = db;
        _businessContext = businessContext;
        _exportService = exportService;
    }

    [HttpPost("download")]
    public async Task<IActionResult> Download(CancellationToken cancellationToken)
    {
        var business = await _db.Businesses
            .FirstOrDefaultAsync(b => b.Id == _businessContext.CurrentBusinessId, cancellationToken);

        if (business is null) return NotFound(new { message = "Business not found." });

        try
        {
            var result = await _exportService.CreateExportAsync(business, cancellationToken);
            return File(result.Content, result.ContentType, result.FileName);
        }
        catch (DirectoryNotFoundException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Website download is not ready yet. Please contact LavLokshan support."
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

