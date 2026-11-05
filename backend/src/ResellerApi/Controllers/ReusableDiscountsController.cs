using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = "OWNER")]
[Route("api/v1/discounts")]
public sealed class ReusableDiscountsController(IReusableDiscountService discounts, ICurrentUserService user) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool includeArchived = false)
        => Ok(await discounts.ListAsync(includeArchived));

    [HttpGet("active-assignments")]
    public async Task<IActionResult> ActiveAssignments()
        => Ok(await discounts.ListActiveAssignmentsAsync());

    [HttpGet("{id:guid}/applied-variants")]
    public async Task<IActionResult> AppliedVariants(Guid id)
    {
        try { return Ok(await discounts.ListAppliedVariantsAsync(id)); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}/applied-variants/{variantId:guid}")]
    public async Task<IActionResult> RemoveVariant(Guid id, Guid variantId)
    {
        try { await discounts.RemoveVariantAsync(id, variantId, user.UserId); return NoContent(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReusableDiscountRequest request)
    {
        try { return Ok(await discounts.CreateAsync(request, user.UserId)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReusableDiscountRequest request)
    {
        try { return Ok(await discounts.UpdateAsync(id, request)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try { await discounts.DeleteAsync(id); return NoContent(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/apply")]
    public async Task<IActionResult> Apply(Guid id, [FromBody] ApplyReusableDiscountRequest request)
    {
        try { return Ok(await discounts.ApplyAsync(id, request, user.UserId)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id)
    {
        try { await discounts.ArchiveAsync(id, true); return NoContent(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id)
    {
        try { await discounts.ArchiveAsync(id, false); return NoContent(); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
    }
}
