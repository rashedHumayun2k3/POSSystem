using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Expenses;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ExpenseService : IExpenseService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public ExpenseService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
    }

    public async Task<PagedResult<ExpenseDto>> ListAsync(ExpenseListRequest req)
    {
        var q = _db.Expenses
            .AsNoTracking()
            .Include(e => e.Category)
            .Include(e => e.Staff)
            .Include(e => e.CreatedByUser)
            .Include(e => e.ApprovedByUser)
            .AsQueryable();

        if (!string.IsNullOrEmpty(req.Status))
            q = q.Where(e => e.Status == req.Status);
        if (req.CategoryId.HasValue)
            q = q.Where(e => e.CategoryId == req.CategoryId.Value);
        if (req.From.HasValue)
            q = q.Where(e => e.ExpenseDate >= req.From.Value);
        if (req.To.HasValue)
            q = q.Where(e => e.ExpenseDate <= req.To.Value);

        var total = await q.CountAsync();
        var pageSize = Math.Clamp(req.PageSize, 1, 100);
        var page = Math.Max(1, req.Page);

        var items = await q
            .OrderByDescending(e => e.ExpenseDate)
            .ThenByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => MapDto(e))
            .ToListAsync();

        return new PagedResult<ExpenseDto>(items, total, page, pageSize);
    }

    public async Task<ExpenseDto> GetAsync(Guid id)
    {
        var e = await _db.Expenses
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Staff)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ApprovedByUser)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException("Expense not found.");
        return MapDto(e);
    }

    public async Task<ExpenseDto> CreateAsync(CreateExpenseRequest req, Guid userId, bool isOwner)
    {
        if (req.Amount <= 0)
            throw new ArgumentException("Amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(req.SubType))
            throw new ArgumentException("SubType is required.");

        var cat = await _db.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == req.CategoryId)
            ?? throw new KeyNotFoundException("Expense category not found.");

        var expense = new Expense
        {
            BusinessId       = _business.CurrentBusinessId,
            CategoryId       = req.CategoryId,
            SubType          = req.SubType.Trim(),
            Amount           = req.Amount,
            ExpenseDate      = req.ExpenseDate.Date,
            StaffId          = req.StaffId,
            IsRecurring      = req.IsRecurring,
            RecurringDay     = req.IsRecurring ? req.RecurringDay : null,
            AllocateToTripId = req.AllocateToTripId,
            PettyCashBoxId   = req.PettyCashBoxId,
            PhotoUrl         = req.PhotoUrl?.Trim(),
            Note             = req.Note?.Trim(),
            Status           = isOwner ? "APPROVED" : "PENDING",
            PaidAt           = isOwner ? DateTime.UtcNow : null,
            CreatedBy        = userId,
            ApprovedBy       = isOwner ? userId : null,
        };
        _db.Expenses.Add(expense);

        // deduct from petty cash box if specified
        if (req.PettyCashBoxId.HasValue)
        {
            var box = await _db.PettyCashBoxes
                .FirstOrDefaultAsync(b => b.Id == req.PettyCashBoxId.Value)
                ?? throw new KeyNotFoundException("Petty cash box not found.");
            if (box.Balance < req.Amount)
                throw new InvalidOperationException("Insufficient petty cash balance.");

            box.Balance -= req.Amount;
            _db.PettyCashTxns.Add(new PettyCashTxn
            {
                BusinessId = _business.CurrentBusinessId,
                BoxId      = box.Id,
                TxnType    = "SPEND",
                Amount     = req.Amount,
                ExpenseId  = expense.Id,
                UserId     = userId,
                Note       = req.SubType.Trim(),
            });
        }

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Expense", expense.Id,
            null, new { expense.Amount, expense.SubType });

        return await GetAsync(expense.Id);
    }

    public async Task<ExpenseDto> UpdateAsync(Guid id, UpdateExpenseRequest req, Guid userId)
    {
        var expense = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id)
            ?? throw new KeyNotFoundException("Expense not found.");

        if (expense.Status != "PENDING" && expense.Status != "APPROVED")
            throw new InvalidOperationException("Only PENDING or APPROVED expenses can be edited.");
        if (expense.PettyCashBoxId.HasValue)
            throw new InvalidOperationException("Expenses paid from petty cash cannot be edited. Delete and re-create.");
        if (req.Amount <= 0)
            throw new ArgumentException("Amount must be greater than zero.");

        expense.CategoryId       = req.CategoryId;
        expense.SubType          = req.SubType.Trim();
        expense.Amount           = req.Amount;
        expense.ExpenseDate      = req.ExpenseDate.Date;
        expense.StaffId          = req.StaffId;
        expense.IsRecurring      = req.IsRecurring;
        expense.RecurringDay     = req.IsRecurring ? req.RecurringDay : null;
        expense.AllocateToTripId = req.AllocateToTripId;
        expense.PhotoUrl         = req.PhotoUrl?.Trim();
        expense.Note             = req.Note?.Trim();

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Expense", expense.Id);
        return await GetAsync(expense.Id);
    }

    public async Task DeleteAsync(Guid id, Guid userId)
    {
        var expense = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id)
            ?? throw new KeyNotFoundException("Expense not found.");

        if (expense.Status == "APPROVED" && expense.PettyCashBoxId.HasValue)
            throw new InvalidOperationException("Cannot delete a petty-cash expense. Adjust the box balance instead.");

        expense.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "DELETE", "Expense", expense.Id);
    }

    public async Task<ExpenseDto> ApproveAsync(Guid id, Guid userId, string? note)
    {
        var expense = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id)
            ?? throw new KeyNotFoundException("Expense not found.");

        if (expense.Status != "PENDING")
            throw new InvalidOperationException("Only PENDING expenses can be approved.");

        expense.Status     = "APPROVED";
        expense.ApprovedBy = userId;
        expense.PaidAt     = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(note))
            expense.Note = note.Trim();

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "APPROVE", "Expense", expense.Id);
        return await GetAsync(expense.Id);
    }

    public async Task<ExpenseDto> RejectAsync(Guid id, Guid userId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Rejection reason is required.");

        var expense = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id)
            ?? throw new KeyNotFoundException("Expense not found.");

        if (expense.Status != "PENDING")
            throw new InvalidOperationException("Only PENDING expenses can be rejected.");

        expense.Status          = "REJECTED";
        expense.RejectionReason = reason.Trim();

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "REJECT", "Expense", expense.Id);
        return await GetAsync(expense.Id);
    }

    private static ExpenseDto MapDto(Expense e) => new(
        e.Id,
        e.CategoryId,
        e.Category?.Name ?? "",
        e.SubType,
        e.Amount,
        e.ExpenseDate,
        e.StaffId,
        e.Staff == null ? null : e.Staff.Name,
        e.IsRecurring,
        e.RecurringDay,
        e.AllocateToTripId,
        e.PettyCashBoxId,
        e.PhotoUrl,
        e.Status,
        e.PaidAt,
        e.CreatedBy,
        e.CreatedByUser?.Name ?? "",
        e.ApprovedBy,
        e.ApprovedByUser?.Name,
        e.Note,
        e.RejectionReason,
        e.CreatedAt
    );
}
