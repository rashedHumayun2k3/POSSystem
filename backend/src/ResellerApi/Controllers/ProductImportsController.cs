using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/products/import")]
[Authorize(Roles = "OWNER")]
public class ProductImportsController(ProductImportService service, ICurrentUserService user) : ControllerBase
{
    [HttpGet("template")]
    public IActionResult Template() => Ok(new { fileName = "Product-Upload-Template.xlsx", base64 = Convert.ToBase64String(ProductImportWorkbook.Template()) });

    [HttpPost("preview")]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<IActionResult> Preview(ProductImportUpload upload)
    {
        try
        {
            var preview = await service.ValidateAsync(ProductImportWorkbook.Read(upload));
            return Ok(new { preview.Rows, Errors = preview.Errors.Where(e => e.Field != "categoryId"), preview.Matches, importId = Guid.NewGuid() });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("validate")]
    [RequestSizeLimit(256 * 1024)]
    public async Task<IActionResult> Validate(ProductImportRequest request)
    {
        try { return Ok(await service.ValidateBatchAsync(request)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("matches")]
    [RequestSizeLimit(256 * 1024)]
    public async Task<IActionResult> Matches(ProductImportRequest request)
    {
        try
        {
            var preview = await service.ValidateAsync(request.Rows);
            return Ok(new { preview.Matches, Errors = preview.Errors.Where(e => e.Field is "sku" or "name") });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("save")]
    [RequestSizeLimit(256 * 1024)]
    public async Task<IActionResult> Save(ProductImportRequest request)
    {
        try { return Ok(await service.SaveAsync(request, user.UserId)); }
        catch (ProductImportValidationException ex) { return BadRequest(new { message = ex.Message, preview = ex.Preview }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (DbUpdateException) { return Conflict(new { message = "The batch could not be saved. Nothing was imported. Check for newly added duplicate products and try again." }); }
        catch (SqlException) { return Conflict(new { message = "Another stock or product update interrupted this import. Nothing was imported. Please retry." }); }
    }

    [HttpPost("errors")]
    [RequestSizeLimit(256 * 1024)]
    public async Task<IActionResult> Errors(ProductImportRequest request)
    {
        try
        {
            var preview = await service.ValidateAsync(request.Rows);
            var report = preview with { Errors = preview.Errors.Where(e => e.Field != "categoryId").ToList() };
            return Ok(new { fileName = "Product-Upload-Errors.xlsx", base64 = Convert.ToBase64String(ProductImportWorkbook.ErrorReport(report)) });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
