using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
namespace ResellerApi.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/expense-reviews")]
public class ExpenseReviewsController(AppDbContext db, IBusinessContext business, ICurrentUserService user) : ControllerBase
{
    public record SeenItem(Guid ExpenseId, int Version);
    public record SeenRequest(List<SeenItem> Items);
    private async Task<Partner?> Reviewer()
    {
        if (await db.Partners.CountAsync(p => p.Status == "ACTIVE") < 2) return null;
        return await db.Partners.FirstOrDefaultAsync(p => p.Status == "ACTIVE" && p.LinkedUserId == user.UserId);
    }
    private IQueryable<Expense> Eligible() => db.Expenses.IgnoreQueryFilters().Where(e => e.BusinessId == business.CurrentBusinessId
        && e.CreatedBy != user.UserId && (e.Status == "APPROVED" || e.Status == "CANCELLED" || e.DeletedAt != null)
        && (business.CurrentBranchId == null || e.BranchId == null || e.BranchId == business.CurrentBranchId)
        && db.Partners.Any(p => p.BusinessId == business.CurrentBusinessId && p.DeletedAt == null && p.Status == "ACTIVE" && p.LinkedUserId == e.CreatedBy));

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 50)
    {
        if (take < 1 || take > 100) return BadRequest();
        var partner = await Reviewer();
        if (partner == null) return Ok(new { total = 0, items = Array.Empty<object>() });
        var unseen = Eligible().AsNoTracking().Where(e => !db.ExpenseReviews.Any(r => r.BusinessId == business.CurrentBusinessId && r.DeletedAt == null && r.ExpenseId == e.Id && r.PartnerId == partner.Id && r.ReviewedVersion == e.ReviewVersion));
        return Ok(new { total = await unseen.CountAsync(), items = await unseen.OrderByDescending(e => e.UpdatedAt).ThenBy(e => e.Id).Take(take)
            .Select(e => new { e.Id, e.Title, e.SubType, e.Amount, e.ExpenseDate, e.CreatedBy, CreatorName = e.CreatedByUser.Name,
                e.PhotoUrl, Version = e.ReviewVersion, Cancelled = e.Status == "CANCELLED" || e.DeletedAt != null }).ToListAsync() });
    }

    [HttpPost]
    public async Task<IActionResult> MarkSeen(SeenRequest request)
    {
        if (request.Items == null || request.Items.Count == 0 || request.Items.Count > 100 || request.Items.Any(i => i.Version < 1)
            || request.Items.Select(i => i.ExpenseId).Distinct().Count() != request.Items.Count) return BadRequest();
        // Use the same business transaction lock as expense corrections to validate the exact displayed version.
        await using var tx = await new ExpenseFundingService(db, business).BeginAsync();
        var partner = await Reviewer();
        if (partner == null) return Forbid();
        var ids = request.Items.Select(i => i.ExpenseId).ToList();
        var expenses = await Eligible().Where(e => ids.Contains(e.Id)).ToListAsync();
        if (expenses.Count != ids.Count) return NotFound();
        if (expenses.Any(e => request.Items.Single(i => i.ExpenseId == e.Id).Version != e.ReviewVersion))
            return Conflict(new { message = "An expense changed. Refresh the list before marking it seen." });
        foreach (var expense in expenses)
            if (!await db.ExpenseReviews.AnyAsync(r => r.ExpenseId == expense.Id && r.PartnerId == partner.Id && r.ReviewedVersion == expense.ReviewVersion))
                db.ExpenseReviews.Add(new ExpenseReview { BusinessId = business.CurrentBusinessId, ExpenseId = expense.Id, PartnerId = partner.Id,
                    ReviewedVersion = expense.ReviewVersion, ReviewedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        return NoContent();
    }
}
