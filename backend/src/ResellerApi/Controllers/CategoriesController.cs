using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/categories")]
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _svc;
    private readonly ICurrentUserService _user;

    public CategoriesController(ICategoryService svc, ICurrentUserService user)
    {
        _svc = svc;
        _user = user;
    }

    [HttpGet]
    public async Task<IActionResult> List() => Ok(await _svc.ListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id) => Ok(await _svc.GetAsync(id));

    [HttpPost]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Create([FromBody] UpsertCategoryRequest request)
    {
        try
        {
            var cat = await _svc.CreateAsync(request, _user.UserId);
            return CreatedAtAction(nameof(Get), new { id = cat.Id }, cat);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertCategoryRequest request)
    {
        try { return Ok(await _svc.UpdateAsync(id, request, _user.UserId)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _svc.DeleteAsync(id, _user.UserId);
        return NoContent();
    }

    // ── Fields ────────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/fields")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> AddField(Guid id, [FromBody] UpsertCategoryFieldRequest request)
    {
        try { return Ok(await _svc.AddFieldAsync(id, request, _user.UserId)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}/fields/{fieldId:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> UpdateField(Guid id, Guid fieldId, [FromBody] UpsertCategoryFieldRequest request)
        => Ok(await _svc.UpdateFieldAsync(id, fieldId, request, _user.UserId));

    [HttpDelete("{id:guid}/fields/{fieldId:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> DeleteField(Guid id, Guid fieldId)
    {
        await _svc.DeleteFieldAsync(id, fieldId, _user.UserId);
        return NoContent();
    }
}
