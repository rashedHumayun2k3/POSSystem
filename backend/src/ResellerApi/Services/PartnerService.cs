using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Partners;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;
using System.Text.RegularExpressions;

namespace ResellerApi.Services;

public class PartnerService : IPartnerService
{
    private static readonly HashSet<string> ValidTypes = new() { "MANAGING", "SLEEPING" };
    private static readonly HashSet<string> ValidDecisions = new() { "APPROVE", "REJECT" };
    private static readonly Regex BangladeshMobileRegex = new(@"^(?:\+?88)?01[3-9]\d{8}$", RegexOptions.Compiled);

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
        if (string.IsNullOrWhiteSpace(request.NidNumber))
            throw new ArgumentException("NID number is required.");
        if (string.IsNullOrWhiteSpace(request.Address))
            throw new ArgumentException("Address is required.");
        var phone = NormalizeOptionalBangladeshMobile(request.Phone, "Partner phone");
        var emergencyContactPhone = NormalizeOptionalBangladeshMobile(request.EmergencyContactPhone, "Emergency contact phone");
        Guid? linkedUserId = request.LinkedUserId;
        if (request.PartnerType == "MANAGING" && !linkedUserId.HasValue)
        {
            var loginPhone = NormalizeOptionalBangladeshMobile(request.LoginPhone, "Login phone")
                ?? throw new ArgumentException("Login phone is required for a new managing partner account.");
            var loginEmail = string.IsNullOrWhiteSpace(request.LoginEmail) ? null : request.LoginEmail.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(request.TemporaryPassword) || request.TemporaryPassword.Length < 8)
                throw new ArgumentException("Temporary password must be at least 8 characters.");
            if (await _db.Users.AnyAsync(u => u.Phone == loginPhone || (loginEmail != null && u.Email == loginEmail)))
                throw new InvalidOperationException("The login phone or email is already registered. Link the existing account instead.");

            var companyId = await _db.Businesses.Where(b => b.Id == _business.CurrentBusinessId).Select(b => b.CompanyId).SingleAsync();
            var loginUser = new User
            {
                CompanyId = companyId,
                Name = request.Name.Trim(),
                Phone = loginPhone,
                Email = loginEmail,
                PhotoUrl = request.PhotoUrl?.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.TemporaryPassword),
                Role = Roles.Owner,
                CanAccessPos = request.CanAccessPos,
                IsActive = true
            };
            _db.Users.Add(loginUser);
            _db.BusinessUsers.Add(new BusinessUser { BusinessId = _business.CurrentBusinessId, UserId = loginUser.Id });
            linkedUserId = loginUser.Id;
        }
        else
        {
            await ValidateLinkedUserAsync(request.PartnerType, linkedUserId);
            if (request.PartnerType == "MANAGING" && linkedUserId.HasValue)
            {
                var linkedUser = await _db.Users.SingleAsync(u => u.Id == linkedUserId.Value);
                linkedUser.Role = Roles.Owner;
                linkedUser.CanAccessPos = request.CanAccessPos;
            }
        }

        // R15.11 bootstrap exception: with zero ACTIVE managing partners, there is no one to vote,
        // so the very first partner(s) ever added to a business auto-approve.
        var activeManagingPartnerCount = await CountActiveManagingPartnersAsync();
        var initialStatus = activeManagingPartnerCount == 0 ? "ACTIVE" : "PENDING_APPROVAL";

        var partner = new Partner
        {
            BusinessId = _business.CurrentBusinessId,
            Name = request.Name.Trim(),
            Phone = phone,
            PhotoUrl = request.PhotoUrl?.Trim(),
            LinkedUserId = request.PartnerType == "MANAGING" ? linkedUserId : null,
            PartnerType = request.PartnerType,
            Status = initialStatus,
            JoinDate = request.JoinDate,
            Note = request.Note?.Trim(),
            NidNumber = request.NidNumber.Trim(),
            Address = request.Address.Trim(),
            Email = request.Email?.Trim(),
            BankAccountNumber = request.BankAccountNumber?.Trim(),
            BankName = request.BankName?.Trim(),
            AgreedProfitSharePct = request.AgreedProfitSharePct,
            EmergencyContactName = request.EmergencyContactName?.Trim(),
            EmergencyContactPhone = emergencyContactPhone,
            EmergencyContactRelation = request.EmergencyContactRelation?.Trim()
        };
        await using var transaction = await _db.Database.BeginTransactionAsync();
        _db.Partners.Add(partner);
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CREATE", "Partner", partner.Id, after: new { partner.Status, partner.LinkedUserId });
        await transaction.CommitAsync();
        return await ToDtoAsync(partner);
    }

    public async Task<PartnerDto> UpdateAsync(Guid id, UpdatePartnerRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Partner name is required.");
        if (!ValidTypes.Contains(request.PartnerType))
            throw new ArgumentException("Partner type must be MANAGING or SLEEPING.");
        if (string.IsNullOrWhiteSpace(request.NidNumber))
            throw new ArgumentException("NID number is required.");
        if (string.IsNullOrWhiteSpace(request.Address))
            throw new ArgumentException("Address is required.");
        var phone = NormalizeOptionalBangladeshMobile(request.Phone, "Partner phone");
        var emergencyContactPhone = NormalizeOptionalBangladeshMobile(request.EmergencyContactPhone, "Emergency contact phone");
        await ValidateLinkedUserAsync(request.PartnerType, request.LinkedUserId, id);

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
        partner.Phone = phone;
        partner.PhotoUrl = request.PhotoUrl?.Trim();
        partner.LinkedUserId = request.PartnerType == "MANAGING" ? request.LinkedUserId : null;
        partner.PartnerType = request.PartnerType;
        partner.JoinDate = request.JoinDate;
        partner.Note = request.Note?.Trim();
        partner.NidNumber = request.NidNumber.Trim();
        partner.Address = request.Address.Trim();
        partner.Email = request.Email?.Trim();
        partner.BankAccountNumber = request.BankAccountNumber?.Trim();
        partner.BankName = request.BankName?.Trim();
        partner.AgreedProfitSharePct = request.AgreedProfitSharePct;
        partner.EmergencyContactName = request.EmergencyContactName?.Trim();
        partner.EmergencyContactPhone = emergencyContactPhone;
        partner.EmergencyContactRelation = request.EmergencyContactRelation?.Trim();
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "UPDATE", "Partner", partner.Id);
        return await ToDtoAsync(partner);
    }

    /// <summary>
    /// R15.11: casts one managing partner's vote on a pending partner and applies the resulting
    /// status transition (ACTIVE/REJECTED) if the vote tips the tally past the majority threshold.
    /// </summary>
    public async Task<PartnerApprovalStatusDto> CastVoteAsync(Guid partnerId, CastApprovalVoteRequest request, Guid userId)
    {
        if (!ValidDecisions.Contains(request.Decision))
            throw new ArgumentException("Decision must be APPROVE or REJECT.");
        if (request.Decision == "REJECT" && string.IsNullOrWhiteSpace(request.Note))
            throw new ArgumentException("A reason is required when rejecting a partner.");

        var partner = await _db.Partners.FirstOrDefaultAsync(p => p.Id == partnerId)
            ?? throw new KeyNotFoundException("Partner not found.");
        if (partner.Status != "PENDING_APPROVAL")
            throw new InvalidOperationException("This partner is not pending approval.");

        var voter = await _db.Partners.FirstOrDefaultAsync(p =>
                p.LinkedUserId == userId && p.PartnerType == "MANAGING" && p.Status == "ACTIVE")
            ?? throw new UnauthorizedAccessException("Your login account is not linked to an active managing partner.");

        var alreadyVoted = await _db.PartnerApprovalVotes
            .AnyAsync(v => v.PartnerId == partnerId && v.VotedByPartnerId == voter.Id);
        if (alreadyVoted)
            throw new InvalidOperationException("This managing partner has already voted on this partner.");

        _db.PartnerApprovalVotes.Add(new PartnerApprovalVote
        {
            BusinessId = _business.CurrentBusinessId,
            PartnerId = partnerId,
            VotedByPartnerId = voter.Id,
            Decision = request.Decision,
            Note = request.Note?.Trim(),
            VotedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "VOTE", "Partner", partnerId,
            after: new { VotedByPartnerId = voter.Id, request.Decision, request.Note });

        var status = await GetApprovalStatusAsync(partnerId);
        var outcome = ComputeOutcome(status.ApproveCount, status.RejectCount, status.RequiredVotes, status.ActiveManagingPartnerCount);
        if (outcome != null && outcome != partner.Status)
        {
            partner.Status = outcome;
            await _db.SaveChangesAsync();
            await _log.LogAsync(_business.CurrentBusinessId, userId, "STATUS_CHANGE", "Partner", partnerId, after: new { partner.Status });
            status = status with { Status = outcome };
        }
        return status;
    }

    /// <summary>
    /// Owner escape hatch: withdraws a still-pending partner request without waiting for votes
    /// to resolve it one way or the other. Mandatory reason, logged permanently (R15.11).
    /// </summary>
    public async Task<PartnerDto> CancelPendingAsync(Guid partnerId, CancelPendingPartnerRequest request, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("A reason is required to cancel a pending partner request.");

        var partner = await _db.Partners.FirstOrDefaultAsync(p => p.Id == partnerId)
            ?? throw new KeyNotFoundException("Partner not found.");
        if (partner.Status != "PENDING_APPROVAL")
            throw new InvalidOperationException("This partner is not pending approval.");

        partner.Status = "REJECTED";
        await _db.SaveChangesAsync();
        await _log.LogAsync(_business.CurrentBusinessId, userId, "CANCEL", "Partner", partnerId, after: new { request.Reason });
        return await ToDtoAsync(partner);
    }

    public async Task<PartnerApprovalStatusDto> GetApprovalStatusAsync(Guid partnerId)
    {
        var partner = await _db.Partners.AsNoTracking().FirstOrDefaultAsync(p => p.Id == partnerId)
            ?? throw new KeyNotFoundException("Partner not found.");

        var votes = await _db.PartnerApprovalVotes.AsNoTracking()
            .Where(v => v.PartnerId == partnerId)
            .Join(_db.Partners.AsNoTracking(), v => v.VotedByPartnerId, p => p.Id, (v, p) => new PartnerApprovalVoteDto(
                v.Id, v.PartnerId, v.VotedByPartnerId, p.Name, v.Decision, v.Note, v.VotedAt))
            .ToListAsync();

        var activeManagingPartnerCount = await CountActiveManagingPartnersAsync();
        return new PartnerApprovalStatusDto(
            partnerId,
            partner.Status,
            votes.Count(v => v.Decision == "APPROVE"),
            votes.Count(v => v.Decision == "REJECT"),
            ComputeApprovalThreshold(activeManagingPartnerCount),
            activeManagingPartnerCount,
            votes);
    }

    private async Task<int> CountActiveManagingPartnersAsync() =>
        await _db.Partners.AsNoTracking().CountAsync(p => p.PartnerType == "MANAGING" && p.Status == "ACTIVE");

    /// <summary>
    /// R15.11: majority of the *current* count of ACTIVE managing partners. Pure static method,
    /// directly unit-testable, mirroring PartnerCapitalService.ComputeBalanceAfter.
    /// </summary>
    public static int ComputeApprovalThreshold(int activeManagingPartnerCount) =>
        activeManagingPartnerCount / 2 + 1;

    /// <summary>
    /// R15.11: returns "ACTIVE" once approvals reach the majority threshold, "REJECTED" once
    /// rejections make reaching that threshold mathematically impossible, or null while the vote
    /// is still undecided. Pure static method, directly unit-testable.
    /// </summary>
    public static string? ComputeOutcome(int approveCount, int rejectCount, int requiredVotes, int totalManagingPartners)
    {
        if (approveCount >= requiredVotes) return "ACTIVE";
        var maxPossibleApprovals = totalManagingPartners - rejectCount;
        if (maxPossibleApprovals < requiredVotes) return "REJECTED";
        return null;
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
            p.Id, p.Name, p.Phone, p.PhotoUrl, p.LinkedUserId, p.PartnerType, p.Status, p.DeferredLossPaisa, p.JoinDate, p.Note,
            balance.CapitalBalancePaisa, balance.ProfitBalancePaisa,
            p.NidNumber, p.Address, p.Email, p.BankAccountNumber, p.BankName, p.AgreedProfitSharePct,
            p.EmergencyContactName, p.EmergencyContactPhone, p.EmergencyContactRelation);
    }

    private static string? NormalizeOptionalBangladeshMobile(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var trimmed = value.Trim();
        if (!BangladeshMobileRegex.IsMatch(trimmed))
            throw new ArgumentException($"{fieldName} must be a valid Bangladesh mobile number.");

        return PhoneNormalizer.Normalize(trimmed);
    }

    private async Task ValidateLinkedUserAsync(string partnerType, Guid? linkedUserId, Guid? partnerId = null)
    {
        if (partnerType != "MANAGING") return;
        if (!linkedUserId.HasValue)
            throw new ArgumentException("A managing partner must be linked to a login account.");

        var validUser = await _db.BusinessUsers.AsNoTracking().AnyAsync(bu =>
            bu.BusinessId == _business.CurrentBusinessId && bu.UserId == linkedUserId && bu.User.IsActive &&
            (bu.User.Role == Roles.Owner || bu.User.Role == Roles.Manager || bu.User.Role == Roles.Partner));
        if (!validUser)
            throw new ArgumentException("The linked login must be an active account in this business.");

        var alreadyLinked = await _db.Partners.AsNoTracking().AnyAsync(p =>
            p.LinkedUserId == linkedUserId && (!partnerId.HasValue || p.Id != partnerId.Value));
        if (alreadyLinked)
            throw new ArgumentException("This login account is already linked to another partner.");
    }
}
