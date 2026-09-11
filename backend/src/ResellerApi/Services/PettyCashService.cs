using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Expenses;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PettyCashService : IPettyCashService
{
    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;

    public PettyCashService(AppDbContext db, IBusinessContext business, IActivityLogService log)
    {
        _db = db;
        _business = business;
        _log = log;
    }

    public async Task<List<PettyCashBoxDto>> ListBoxesAsync()
    {
        return await _db.PettyCashBoxes
            .AsNoTracking()
            .Include(b => b.Staff)
            .Select(b => new PettyCashBoxDto(b.Id, b.StaffId, b.Staff.Name, b.Balance, b.CreatedAt))
            .ToListAsync();
    }

    public async Task<PettyCashBoxDto> GetBoxAsync(Guid id)
    {
        var b = await _db.PettyCashBoxes
            .AsNoTracking()
            .Include(x => x.Staff)
            .FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException("Petty cash box not found.");
        return new PettyCashBoxDto(b.Id, b.StaffId, b.Staff.Name, b.Balance, b.CreatedAt);
    }

    public async Task<PettyCashBoxDto> GetOrCreateBoxForStaffAsync(Guid staffId, Guid userId)
    {
        var branchId = _business.CurrentBranchId
            ?? throw new InvalidOperationException("A branch must be selected to access a petty cash box.");

        var box = await _db.PettyCashBoxes.FirstOrDefaultAsync(b => b.StaffId == staffId && b.BranchId == branchId);
        if (box != null)
        {
            await _db.Entry(box).Reference(b => b.Staff).LoadAsync();
            return new PettyCashBoxDto(box.Id, box.StaffId, box.Staff.Name, box.Balance, box.CreatedAt);
        }

        box = new PettyCashBox
        {
            BusinessId = _business.CurrentBusinessId,
            BranchId   = branchId,
            StaffId    = staffId,
            Balance    = 0,
        };
        _db.PettyCashBoxes.Add(box);
        await _db.SaveChangesAsync();
        await _db.Entry(box).Reference(b => b.Staff).LoadAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "PettyCashBox", box.Id);
        return new PettyCashBoxDto(box.Id, box.StaffId, box.Staff.Name, box.Balance, box.CreatedAt);
    }

    public async Task<PettyCashBoxDto> FundAsync(Guid boxId, FundPettyCashRequest req, Guid userId)
    {
        if (req.Amount <= 0)
            throw new ArgumentException("Fund amount must be positive.");

        var box = await _db.PettyCashBoxes.Include(b => b.Staff).FirstOrDefaultAsync(b => b.Id == boxId)
            ?? throw new KeyNotFoundException("Petty cash box not found.");

        box.Balance += req.Amount;
        _db.PettyCashTxns.Add(new PettyCashTxn
        {
            BusinessId = _business.CurrentBusinessId,
            BoxId      = box.Id,
            TxnType    = "FUND_IN",
            Amount     = req.Amount,
            UserId     = userId,
            Note       = req.Note?.Trim(),
        });

        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "FUND_IN", "PettyCashBox", box.Id,
            null, new { req.Amount });
        return new PettyCashBoxDto(box.Id, box.StaffId, box.Staff.Name, box.Balance, box.CreatedAt);
    }

    public async Task<PettyCashBoxDto> AdjustAsync(Guid boxId, AdjustPettyCashRequest req, Guid userId)
    {
        if (req.NewBalance < 0)
            throw new ArgumentException("Balance cannot be negative.");

        var box = await _db.PettyCashBoxes.Include(b => b.Staff).FirstOrDefaultAsync(b => b.Id == boxId)
            ?? throw new KeyNotFoundException("Petty cash box not found.");

        var diff = req.NewBalance - box.Balance;
        _db.PettyCashTxns.Add(new PettyCashTxn
        {
            BusinessId = _business.CurrentBusinessId,
            BoxId      = box.Id,
            TxnType    = "ADJUST",
            Amount     = Math.Abs(diff),
            UserId     = userId,
            Note       = req.Note?.Trim() ?? $"Adjustment {(diff >= 0 ? "+" : "")}{diff:F2}",
        });

        box.Balance = req.NewBalance;
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "ADJUST", "PettyCashBox", box.Id,
            new { OldBalance = box.Balance }, new { req.NewBalance });
        return new PettyCashBoxDto(box.Id, box.StaffId, box.Staff.Name, box.Balance, box.CreatedAt);
    }

    public async Task<List<PettyCashTxnDto>> ListTxnsAsync(Guid boxId, int limit)
    {
        return await _db.PettyCashTxns
            .AsNoTracking()
            .Include(t => t.User)
            .Include(t => t.Expense)
            .Where(t => t.BoxId == boxId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .Select(t => new PettyCashTxnDto(
                t.Id, t.TxnType, t.Amount, t.ExpenseId,
                t.Expense != null ? t.Expense.SubType : null,
                t.UserId, t.User.Name, t.Note, t.CreatedAt))
            .ToListAsync();
    }
}
