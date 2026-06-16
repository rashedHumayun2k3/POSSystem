using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/categories")]
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _svc;

    public CategoriesController(ICategoryService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> List() => Ok(await _svc.ListAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id) => Ok(await _svc.GetAsync(id));

    [HttpPost]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Create([FromBody] UpsertCategoryRequest request)
    {
        var cat = await _svc.CreateAsync(request);
        return CreatedAtAction(nameof(Get), new { id = cat.Id }, cat);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertCategoryRequest request)
        => Ok(await _svc.UpdateAsync(id, request));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _svc.DeleteAsync(id);
        return NoContent();
    }

    // ── Fields ────────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/fields")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> AddField(Guid id, [FromBody] UpsertCategoryFieldRequest request)
        => Ok(await _svc.AddFieldAsync(id, request));

    [HttpPut("{id:guid}/fields/{fieldId:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> UpdateField(Guid id, Guid fieldId, [FromBody] UpsertCategoryFieldRequest request)
        => Ok(await _svc.UpdateFieldAsync(id, fieldId, request));

    [HttpDelete("{id:guid}/fields/{fieldId:guid}")]
    [Authorize(Roles = "OWNER")]
    public async Task<IActionResult> DeleteField(Guid id, Guid fieldId)
    {
        await _svc.DeleteFieldAsync(id, fieldId);
        return NoContent();
    }
}
