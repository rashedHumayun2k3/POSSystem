using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Partners;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PartnerService : IPartnerService
{
    private static readonly HashSet<string> ValidTypes = new() { "MANAGING", "SLEEPING" };

    private readonly AppDbContext _db;
    private readonly IBusinessContext _business;
    private readonly IActivityLogService _log;
    private readonly IPartnerCapitalService _capital;

    public PartnerService(AppDbContext db, IBusinessContext business, IActivityLogService log, IPartnerCapitalService capital)
    {
        _db = db;
        _business = business;
        _log = log;
        _capital = capital;
    }

    public async Task<List<PartnerDto>> ListAsync(string? partnerType, string? status)
    {
        var q = _db.Partners.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(partnerType))
            q = q.Where(p => p.PartnerType == partnerType);
        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(p => p.Status == status);

        var partners = await q.OrderBy(p => p.PartnerType).ThenBy(p => p.Name).ToListAsync();
        var result = new List<PartnerDto>(partners.Count);
        foreach (var p in partners)
            result.Add(await ToDtoAsync(p));
        return result;
    }

    public async Task<PartnerDto> GetAsync(Guid id)
    {
        var p = await _db.Partners.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException("Partner not found.");
        return await ToDtoAsync(p);
    }

    public async Task<PartnerDto> CreateAsync(CreatePartnerRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Partner name is required.");
        if (!ValidTypes.Contains(request.PartnerType))
            throw new ArgumentException("Partner type must be MANAGING or SLEEPING.");

        var partner = new Partner
        {
            BusinessId = _business.CurrentBusinessId,
            Name = request.Name.Trim(),
            Phone = request.Phone?.Trim(),
            PartnerType = request.PartnerType,
            Status = "ACTIVE",
            JoinDate = request.JoinDate,
            Note = request.Note?.Trim()
        };
        _db.Partners.Add(partner);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Partner", partner.Id);
        return await ToDtoAsync(partner);
    }

    public async Task<PartnerDto> UpdateAsync(Guid id, UpdatePartnerRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Partner name is required.");
        if (!ValidTypes.Contains(request.PartnerType))
            throw new ArgumentException("Partner type must be MANAGING or SLEEPING.");

        var partner = await _db.Partners.FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new KeyNotFoundException("Partner not found.");

        if (partner.PartnerType != request.PartnerType)
        {
            var hasLedgerHistory = await _db.CapitalLedgerEntries.AnyAsync(l => l.PartnerId == id);
            if (!CanChangePartnerType(partner.PartnerType, request.PartnerType, hasLedgerHistory))
                throw new InvalidOperationException(
                    "Partner type cannot be changed once a capital ledger entry exists. Mark this partner EXITED and create a new partner record instead.");
        }

        partner.Name = request.Name.Trim();
        partner.Phone = request.Phone?.Trim();
        partner.PartnerType = request.PartnerType;
        partner.JoinDate = request.JoinDate;
        partner.Note = request.Note?.Trim();
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Partner", partner.Id);
        return await ToDtoAsync(partner);
    }

    /// <summary>
    /// R15.1 / R10: partner type is immutable once any capital ledger entry exists for that
    /// partner. Pure static rule so it's directly unit-testable without a DbContext.
    /// </summary>
    public static bool CanChangePartnerType(string currentType, string newType, bool hasLedgerHistory) =>
        currentType == newType || !hasLedgerHistory;

    private async Task<PartnerDto> ToDtoAsync(Partner p)
    {
        var balance = await _capital.GetBalanceAsync(p.Id);
        return new PartnerDto(
            p.Id, p.Name, p.Phone, p.PartnerType, p.Status, p.DeferredLossPaisa, p.JoinDate, p.Note,
            balance.CapitalBalancePaisa, balance.ProfitBalancePaisa);
    }
}
