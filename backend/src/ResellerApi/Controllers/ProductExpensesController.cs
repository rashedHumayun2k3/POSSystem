using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Authorize(Roles = Roles.OwnerOrManager)]
[Route("api/v1/products/{productId:guid}/expenses")]
public class ProductExpensesController(AppDbContext db, IBusinessContext business, ICurrentUserService user, IActivityLogService log) : ControllerBase
{
    // Include shared expenses as well as expenses in the active branch, never other businesses.
    private IQueryable<Expense> Expenses() => db.Expenses.IgnoreQueryFilters().Where(e => e.DeletedAt == null && e.BusinessId == business.CurrentBusinessId
        && (business.CurrentBranchId == null || e.BranchId == null || e.BranchId == business.CurrentBranchId));
    private Task<bool> ProductExists(Guid id) => db.Products.AnyAsync(p => p.Id == id && p.BusinessId == business.CurrentBusinessId);
    public record ExpenseRow(Guid Id, string? Title, string SubType, decimal Amount, DateTime ExpenseDate, string Status, string? Note, Guid CreatedBy, DateTime UpdatedAt, bool IsAccountingPeriodClosed);

    [HttpGet("{expenseId:guid}")]
    public async Task<IActionResult> Detail(Guid productId, Guid expenseId)
    {
        if (!await ProductExists(productId)) return NotFound();
        var expense = await Expenses().AsNoTracking().Where(e => e.Id == expenseId && e.ProductId == productId)
            .Select(e => new { e.Id, e.Title, e.SubType, e.Amount, e.ExpenseDate, e.Status, e.Note, CategoryName = e.Category.Name, CreatedByName = e.CreatedByUser.Name }).FirstOrDefaultAsync();
        return expense == null ? NotFound() : Ok(expense);
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid productId, [FromQuery] bool available = false, [FromQuery] string? search = null, [FromQuery] int skip = 0, [FromQuery] int take = 25)
    {
        if (!await ProductExists(productId)) return NotFound();
        if (skip < 0 || take < 1 || take > 100) return BadRequest();
        var query = Expenses().AsNoTracking();
        query = available ? query.Where(e => e.Status == "APPROVED" && e.ProductId == null && e.AllocateToTripId == null) : query.Where(e => e.ProductId == productId && (e.Status == "APPROVED" || e.Status == "PENDING"));
        if (!string.IsNullOrWhiteSpace(search)) { var term = search.Trim(); query = query.Where(e => (e.Title != null && e.Title.Contains(term)) || e.SubType.Contains(term) || (e.Note != null && e.Note.Contains(term))); }
        var closedThrough = await db.AccountingPeriodClosings.AsNoTracking().OrderByDescending(c => c.PeriodEnd).Select(c => (DateTime?)c.PeriodEnd).FirstOrDefaultAsync();
        return Ok(new { total = await query.CountAsync(), items = await query.OrderByDescending(e => e.ExpenseDate).ThenByDescending(e => e.Id).Skip(skip).Take(take)
            .Select(e => new ExpenseRow(e.Id, e.Title, e.SubType, e.Amount, e.ExpenseDate, e.Status, e.Note, e.CreatedBy, e.UpdatedAt, closedThrough != null && e.ExpenseDate <= closedThrough)).ToListAsync() });
    }

    [HttpPut("{expenseId:guid}")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Link(Guid productId, Guid expenseId)
    {
        if (!await ProductExists(productId)) return NotFound();
        var expense = await Expenses().FirstOrDefaultAsync(e => e.Id == expenseId);
        if (expense == null) return NotFound();
        if (expense.Status != "APPROVED" || expense.AllocateToTripId != null) return Conflict(new { message = "Only approved expenses not allocated to a PO can be linked." });
        if (expense.ProductId == productId) return NoContent();
        if (expense.ProductId != null) return Conflict(new { message = "This expense is already linked to another product." });
        expense.ProductId = productId;
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "This expense changed. Refresh and try again." }); }
        await log.LogAsync(business.CurrentBusinessId, user.UserId, "UPDATE", "ExpenseProduct", expense.Id, new { ProductId = (Guid?)null }, new { ProductId = productId });
        return NoContent();
    }

    [HttpDelete("{expenseId:guid}")]
    [Authorize(Roles = Roles.Owner)]
    public async Task<IActionResult> Unlink(Guid productId, Guid expenseId)
    {
        if (!await ProductExists(productId)) return NotFound();
        var expense = await Expenses().FirstOrDefaultAsync(e => e.Id == expenseId && e.ProductId == productId);
        if (expense == null) return NotFound();
        expense.ProductId = null;
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "This expense changed. Refresh and try again." }); }
        await log.LogAsync(business.CurrentBusinessId, user.UserId, "UPDATE", "ExpenseProduct", expense.Id, new { ProductId = productId }, new { ProductId = (Guid?)null });
        return NoContent();
    }
}
