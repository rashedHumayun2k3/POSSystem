using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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

    private ExpenseFundingService Funding => new(_db, _business);

    // Mirrors the frontend's QUICK_SUBTYPES (expenses/new/page.tsx) — duplicated rather than
    // shared, since SubType is still free text on the wire. Used only to fold obviously-equal
    // entries ("electricity bill" -> "Electricity") into one canonical spelling at save time, not
    // to restrict input to this list.
    private static readonly Dictionary<string, string[]> CanonicalSubtypes = new()
    {
        ["OFFICE"] = new[] { "Rent", "Electricity", "Internet", "Stationery", "Cleaning", "Mobile/Phone Bill", "Bank/MFS Charge" },
        ["STAFF"] = new[] { "Salary", "Delivery rider salary", "Bonus", "Advance", "Overtime", "Transport allowance" },
        ["MARKETING"] = new[] { "Facebook Ads", "Boost post", "Banner", "Packaging design", "Promotional gift" },
        ["DELIVERY"] = new[] { "Courier fee", "Return charge", "COD collection charge", "Petrol", "Van/Rickshaw rent", "Vehicle maintenance", "Toll/Ferry", "Parking", "Packaging Materials" },
        ["TRIP"] = new[] { "Flight ticket", "Hotel", "Food", "Visa fee", "Customs", "Local transport" },
        ["EQUIPMENT_OTHER"] = new[] { "Equipment purchase", "Repair", "Furniture", "Software", "Miscellaneous" },
        ["OWNER_DRAWING"] = new[] { "Personal drawing", "Personal transfer" },
        ["INVENTORY_LOSS"] = new[] { "Damage Loss", "Expired/Near-expiry write-off", "Theft/Pilferage", "Stock count adjustment" },
        ["SETUP_CAPEX"] = new[] { "Shop Rent Advance/Deposit", "Shop Decoration/Renovation", "CCTV & Security System", "Signboard/Branding", "POS/Computer Setup", "Initial Furniture & Fixtures", "Shop/Property Purchase", "Business Registration/Trade License" },
    };

    // Trim + collapse internal whitespace always; fold onto the canonical spelling only on an
    // exact case-insensitive match, so it never mangles a genuinely different subtype the owner
    // typed on purpose.
    private static string NormalizeSubType(string categoryCode, string raw)
    {
        var cleaned = System.Text.RegularExpressions.Regex.Replace(raw.Trim(), @"\s+", " ");
        if (CanonicalSubtypes.TryGetValue(categoryCode, out var options))
        {
            var match = options.FirstOrDefault(o => string.Equals(o, cleaned, StringComparison.OrdinalIgnoreCase));
            if (match != null) return match;
        }
        return cleaned;
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

        var itemIds = items.Select(e => e.Id).ToList();
        var corrections = await _db.ActivityLogs.AsNoTracking()
            .Where(l => l.BusinessId == _business.CurrentBusinessId && l.EntityType == "Expense" &&
                l.Action == "CORRECT" && l.EntityId.HasValue && itemIds.Contains(l.EntityId.Value))
            .OrderByDescending(l => l.CreatedAt)
            .ThenByDescending(l => l.Id)
            .Select(l => new { ExpenseId = l.EntityId!.Value, l.UserId })
            .ToListAsync();
        var lastCorrectors = corrections.GroupBy(l => l.ExpenseId)
            .ToDictionary(group => group.Key, group => group.First().UserId);
        items = items.Select(e => e with { LastCorrectedBy = lastCorrectors.TryGetValue(e.Id, out var editor) ? (Guid?)editor : null }).ToList();

        var closing = await Funding.LatestClosingAsync();
        if (closing != null)
            items = items.Select(e => e with { IsAccountingPeriodClosed = e.ExpenseDate.Date <= closing.PeriodEnd.Date }).ToList();
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
        var investmentId = e.FundingSource == "PERSONAL"
            ? await _db.CapitalInjections.IgnoreQueryFilters().AsNoTracking()
                .Where(i => i.BusinessId == _business.CurrentBusinessId && i.ExpenseId == e.Id && i.DeletedAt == null)
                .Select(i => (Guid?)i.Id).FirstOrDefaultAsync()
            : null;
        var closing = await Funding.LatestClosingAsync();
        return MapDto(e) with { FundingPartnerId = e.FundingPartnerId, PersonalInvestmentId = investmentId,
            IsAccountingPeriodClosed = closing != null && e.ExpenseDate.Date <= closing.PeriodEnd.Date };
    }

    public async Task<ExpenseDto> CreateAsync(CreateExpenseRequest req, Guid userId, bool isOwner)
    {
        if (req.Amount <= 0)
            throw new ArgumentException("Amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(req.SubType))
            throw new ArgumentException("SubType is required.");
        if (req.Title?.Trim().Length > 150)
            throw new ArgumentException("Title must be 150 characters or fewer.");

        ExpenseFundingService.ToPaisa(req.Amount);
        var source = req.FundingSource?.Trim().ToUpperInvariant();
        if (source != null && source != "BUSINESS" && source != "PERSONAL")
            throw new ArgumentException("Choose Business Capital or Paid personally.");
        if (source != null && (!req.RequestId.HasValue || req.RequestId == Guid.Empty))
            throw new ArgumentException("A request ID is required for a funded expense.");
        if (source != null && req.PettyCashBoxId.HasValue)
            throw new ArgumentException("Choose one payment source only.");
        await using var tx = await Funding.BeginAsync();
        await Funding.EnsureDateOpenAsync(req.ExpenseDate);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(req))));
        if (req.RequestId.HasValue)
        {
            var previous = await _db.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e =>
                e.BusinessId == _business.CurrentBusinessId && e.RequestId == req.RequestId);
            if (previous != null)
            {
                if (previous.CreatedBy != userId || previous.RequestHash != hash || previous.DeletedAt != null)
                    throw new InvalidOperationException("This save request has already been used. Start a new expense.");
                return await GetAsync(previous.Id);
            }
        }
        var autoApprove = await Funding.IsOnlyApprovingMemberAsync(userId);
        var partner = source == "PERSONAL" ? await Funding.PartnerAsync(userId) : null;
        if (source == "PERSONAL" && partner == null)
            throw new InvalidOperationException("Your account must be linked to an active business partner to record a personal investment.");
        if (source == "PERSONAL" && !autoApprove && !await _db.Partners.AnyAsync(p => p.Status == "ACTIVE" && p.PartnerType == "MANAGING"))
            throw new InvalidOperationException("An active managing partner is required to review the investment.");
        if (source != "PERSONAL" && (autoApprove || source == "BUSINESS" || req.PettyCashBoxId.HasValue))
            await Funding.CheckBusinessPaymentAsync(req.Amount);

        var cat = await _db.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == req.CategoryId)
            ?? throw new KeyNotFoundException("Expense category not found.");

        var expense = new Expense
        {
            FundingSource = source,
            FundingPartnerId = partner?.Id,
            FundingPartnerName = partner?.Name,
            RequestId = req.RequestId,
            RequestHash = hash,
            BusinessId       = _business.CurrentBusinessId,
            BranchId         = req.BranchId ?? _business.CurrentBranchId,
            CategoryId       = req.CategoryId,
            SubType          = NormalizeSubType(cat.Code, req.SubType),
            Title            = string.IsNullOrWhiteSpace(req.Title) ? null : req.Title.Trim(),
            Amount           = req.Amount,
            ExpenseDate      = req.ExpenseDate.Date,
            StaffId          = req.StaffId,
            IsRecurring      = req.IsRecurring,
            RecurringDay     = req.IsRecurring ? req.RecurringDay : null,
            AllocateToTripId = req.AllocateToTripId,
            PettyCashBoxId   = req.PettyCashBoxId,
            PhotoUrl         = req.PhotoUrl?.Trim(),
            Note             = req.Note?.Trim(),
            Status           = autoApprove ? "APPROVED" : "PENDING",
            PaidAt           = autoApprove ? DateTime.UtcNow : null,
            CreatedBy        = userId,
            ApprovedBy       = autoApprove ? userId : null,
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
        if (autoApprove) { await Funding.AddPersonalInvestmentAsync(expense); await _db.SaveChangesAsync(); }
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Expense", expense.Id,
            null, new { expense.Amount, expense.SubType, expense.FundingSource, expense.FundingPartnerId });
        if (tx != null) await tx.CommitAsync();

        return await GetAsync(expense.Id);
    }

    public async Task<ExpenseDto> UpdateAsync(Guid id, UpdateExpenseRequest req, Guid userId)
    {
        await using var tx = await Funding.BeginAsync();
        var expense = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id)
            ?? throw new KeyNotFoundException("Expense not found.");
        if (expense.CreatedBy != userId)
            throw new UnauthorizedAccessException("Only the creator can edit this expense.");

        if (expense.FundingSource != null)
            throw new InvalidOperationException("Expenses with a recorded funding source cannot be edited or deleted. Record a separate correction instead.");

        if (expense.Status != "PENDING" && expense.Status != "APPROVED")
            throw new InvalidOperationException("Only PENDING or APPROVED expenses can be edited.");
        if (expense.PettyCashBoxId.HasValue)
            throw new InvalidOperationException("Expenses paid from petty cash cannot be edited. Delete and re-create.");
        if (req.Amount <= 0)
            throw new ArgumentException("Amount must be greater than zero.");

        var cat = await _db.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == req.CategoryId)
            ?? throw new KeyNotFoundException("Expense category not found.");

        ExpenseFundingService.ToPaisa(req.Amount);
        if (expense.Status == "APPROVED" && req.Amount > expense.Amount)
            await Funding.CheckBusinessPaymentAsync(req.Amount - expense.Amount);
        await Funding.EnsureDateOpenAsync(expense.ExpenseDate);
        await Funding.EnsureDateOpenAsync(req.ExpenseDate);
        expense.CategoryId       = req.CategoryId;
        expense.SubType          = NormalizeSubType(cat.Code, req.SubType);
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
        if (tx != null) await tx.CommitAsync();
        return await GetAsync(expense.Id);
    }

    public async Task DeleteAsync(Guid id, Guid userId)
    {
        await using var tx = await Funding.BeginAsync();
        var expense = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id)
            ?? throw new KeyNotFoundException("Expense not found.");
        if (expense.CreatedBy != userId)
            throw new UnauthorizedAccessException("Only the creator can delete this expense.");

        if (expense.FundingSource != null)
            throw new InvalidOperationException("Expenses with a recorded funding source cannot be edited or deleted. Record a separate correction instead.");

        if (expense.Status == "APPROVED" && expense.PettyCashBoxId.HasValue)
            throw new InvalidOperationException("Cannot delete a petty-cash expense. Adjust the box balance instead.");

        await Funding.EnsureDateOpenAsync(expense.ExpenseDate);
        expense.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "DELETE", "Expense", expense.Id);
        if (tx != null) await tx.CommitAsync();
    }

    public async Task<ExpenseDto> ApproveAsync(Guid id, Guid userId, string? note)
    {
        await using var tx = await Funding.BeginAsync();
        var expense = await _db.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e =>
            e.Id == id && e.BusinessId == _business.CurrentBusinessId && e.DeletedAt == null)
            ?? throw new KeyNotFoundException("Expense not found.");

        if (expense.Status != "PENDING")
            throw new InvalidOperationException("Only PENDING expenses can be approved.");

        await EnsureReviewerAsync(expense, userId);

        if (expense.FundingSource != "PERSONAL" && !expense.PettyCashBoxId.HasValue)
            await Funding.CheckBusinessPaymentAsync(expense.Amount);
        await Funding.AddPersonalInvestmentAsync(expense);
        await Funding.EnsureDateOpenAsync(expense.ExpenseDate);
        expense.Status     = "APPROVED";
        expense.ApprovedBy = userId;
        expense.PaidAt     = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(note))
            expense.Note = note.Trim();

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "APPROVE", "Expense", expense.Id);
        if (tx != null) await tx.CommitAsync();
        return MapDto(expense);
    }

    public async Task<ExpenseDto> RejectAsync(Guid id, Guid userId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Rejection reason is required.");

        await using var tx = await Funding.BeginAsync();
        var expense = await _db.Expenses.IgnoreQueryFilters().FirstOrDefaultAsync(e =>
            e.Id == id && e.BusinessId == _business.CurrentBusinessId && e.DeletedAt == null)
            ?? throw new KeyNotFoundException("Expense not found.");

        if (expense.Status != "PENDING")
            throw new InvalidOperationException("Only PENDING expenses can be rejected.");

        await EnsureReviewerAsync(expense, userId);

        if (expense.PettyCashBoxId.HasValue)
        {
            var box = await _db.PettyCashBoxes.FirstAsync(b => b.Id == expense.PettyCashBoxId.Value);
            box.Balance += expense.Amount;
            _db.PettyCashTxns.Add(new PettyCashTxn { BusinessId = expense.BusinessId,
                BoxId = box.Id, TxnType = "FUND_IN", Amount = expense.Amount, ExpenseId = expense.Id,
                UserId = userId, Note = "Rejected expense refund" });
        }
        expense.Status          = "REJECTED";
        expense.RejectionReason = reason.Trim();

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "REJECT", "Expense", expense.Id);
        if (tx != null) await tx.CommitAsync();
        return MapDto(expense);
    }

    private async Task EnsureReviewerAsync(Expense expense, Guid userId)
    {
        if (expense.CreatedBy == userId)
            throw new InvalidOperationException("You cannot approve or reject your own expense.");
        var editor = await _db.ActivityLogs.Where(l => l.EntityType == "Expense" && l.EntityId == expense.Id && l.Action == "CORRECT")
            .OrderByDescending(l => l.CreatedAt).Select(l => (Guid?)l.UserId).FirstOrDefaultAsync();
        if (editor == userId) throw new InvalidOperationException("Another user must review your correction.");
        var owner = await _db.Users.AnyAsync(u => u.Id == userId && u.IsActive && u.Role == Roles.Owner);
        var manager = await _db.Partners.AnyAsync(p => p.LinkedUserId == userId &&
            p.Status == "ACTIVE" && p.PartnerType == "MANAGING");
        if (!owner && !manager)
            throw new InvalidOperationException("Only an owner or active managing partner can review expenses.");
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
        e.CreatedAt,
        e.FundingSource,
        e.FundingPartnerName,
        e.FundingPartnerId,
        null,
        e.UpdatedAt
    ) { Title = e.Title };
}
