using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ResellerApi.Data;
using ResellerApi.DTOs.PlatformAdmin;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PlatformAdminService : IPlatformAdminService
{
    private static readonly HashSet<string> ValidStatuses = new(StringComparer.OrdinalIgnoreCase) { "ACTIVE", "SUSPENDED" };

    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public PlatformAdminService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<PlatformAdminLoginResponse> LoginAsync(PlatformAdminLoginRequest request)
    {
        var account = await _db.PlatformAdminAccounts
            .FirstOrDefaultAsync(a => a.Username == request.Username && a.IsActive);

        if (account is null || !BCrypt.Net.BCrypt.Verify(request.Password, account.PasswordHash))
            throw new UnauthorizedAccessException("Invalid username or password.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "platform-admin"),
            new Claim(ClaimTypes.Name, "Platform Admin"),
            new Claim(ClaimTypes.Role, Roles.PlatformAdmin)
        };

        var jwtToken = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(jwtToken);
        return new PlatformAdminLoginResponse(accessToken);
    }

    public async Task<List<AdminCompanyListItemDto>> GetCompaniesAsync(string? search)
    {
        var query = _db.Companies.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(c => c.Name.Contains(search));

        var rows = await query
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Status,
                c.CreatedAt,
                BusinessCount = c.Businesses.Count,
                UserCount = c.Users.Count(u => u.IsActive),
                Subscription = _db.Subscriptions
                    .Where(s => s.CompanyId == c.Id)
                    .Select(s => new { s.Status, s.TrialEndsAt, s.CurrentPeriodEnd, PlanCode = s.Plan.Code })
                    .FirstOrDefault(),
                TotalFeesPaid = _db.SubscriptionPayments
                    .Where(p => p.Subscription.CompanyId == c.Id && p.Status == "SUCCESS")
                    .Sum(p => (decimal?)p.Amount) ?? 0m,
                PrimaryBusiness = c.Businesses
                    .OrderBy(b => b.CreatedAt)
                    .Select(b => new { b.Id, b.ShowOnMarketplace })
                    .FirstOrDefault()
            })
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return rows.Select(c => new AdminCompanyListItemDto(
            c.Id, c.Name, c.Status, c.CreatedAt, c.BusinessCount, c.UserCount,
            c.Subscription?.PlanCode, c.Subscription?.Status, c.Subscription?.TrialEndsAt, c.Subscription?.CurrentPeriodEnd,
            c.TotalFeesPaid, c.PrimaryBusiness?.Id, c.PrimaryBusiness?.ShowOnMarketplace ?? false
        )).ToList();
    }

    public async Task SetCompanyStatusAsync(Guid companyId, SetCompanyStatusRequest request)
    {
        var status = request.Status.ToUpperInvariant();
        if (!ValidStatuses.Contains(status))
            throw new ArgumentException($"Invalid status: {request.Status}. Allowed: ACTIVE, SUSPENDED.");

        var company = await _db.Companies.FirstOrDefaultAsync(c => c.Id == companyId)
            ?? throw new KeyNotFoundException("Company not found.");

        company.Status = status;
        _db.PlatformAdminAuditLogs.Add(new PlatformAdminAuditLog
        {
            CompanyId = companyId,
            Action = status == "ACTIVE" ? "ACTIVATE_COMPANY" : "DEACTIVATE_COMPANY",
            Note = request.Note
        });

        await _db.SaveChangesAsync();
    }

    public async Task SetMarketplaceVisibilityAsync(Guid companyId, SetMarketplaceVisibilityRequest request)
    {
        var business = await _db.Businesses
            .Where(b => b.CompanyId == companyId)
            .OrderBy(b => b.CreatedAt)
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("No business found for this company.");

        business.ShowOnMarketplace = request.Show;
        _db.PlatformAdminAuditLogs.Add(new PlatformAdminAuditLog
        {
            CompanyId = companyId,
            Action = "SET_MARKETPLACE_VISIBILITY",
            Note = request.Note,
            DetailsJson = JsonSerializer.Serialize(new { businessId = business.Id, show = request.Show })
        });

        await _db.SaveChangesAsync();
    }

    public async Task ExtendSubscriptionAsync(Guid companyId, ExtendSubscriptionRequest request)
    {
        if (request.AddDays is null && request.NewPeriodEnd is null)
            throw new ArgumentException("Either AddDays or NewPeriodEnd must be provided.");

        var sub = await _db.Subscriptions.FirstOrDefaultAsync(s => s.CompanyId == companyId)
            ?? throw new KeyNotFoundException("No subscription found for this company.");

        var now = DateTime.UtcNow;
        var newPeriodEnd = request.NewPeriodEnd
            ?? (sub.CurrentPeriodEnd is { } current && current > now ? current : now).AddDays(request.AddDays!.Value);

        sub.CurrentPeriodStart ??= now;
        sub.CurrentPeriodEnd = newPeriodEnd;
        sub.Status = "ACTIVE";

        if (request.AmountCollected is > 0)
        {
            _db.SubscriptionPayments.Add(new SubscriptionPayment
            {
                SubscriptionId = sub.Id,
                Amount = request.AmountCollected.Value,
                Method = "MANUAL",
                Status = "SUCCESS",
                GatewayPaymentId = $"MANUAL-{Guid.NewGuid():N}",
                PaidAt = now
            });
        }

        _db.PlatformAdminAuditLogs.Add(new PlatformAdminAuditLog
        {
            CompanyId = companyId,
            Action = "EXTEND_SUBSCRIPTION",
            Note = request.Note,
            DetailsJson = JsonSerializer.Serialize(new { newPeriodEnd, amountCollected = request.AmountCollected })
        });

        await _db.SaveChangesAsync();
    }

    public async Task<PlatformAdminStatsDto> GetStatsAsync()
    {
        var now = DateTime.UtcNow;
        var weekAgo = now.AddDays(-7);
        var monthAgo = now.AddDays(-30);

        var totalCompanies = await _db.Companies.CountAsync();
        var newThisWeek = await _db.Companies.CountAsync(c => c.CreatedAt >= weekAgo);
        var newThisMonth = await _db.Companies.CountAsync(c => c.CreatedAt >= monthAgo);
        var trialingCount = await _db.Subscriptions.CountAsync(s => s.Status == "TRIALING");
        var activePaidCount = await _db.Subscriptions.CountAsync(s => s.Status == "ACTIVE");
        var totalRevenue = await _db.SubscriptionPayments.Where(p => p.Status == "SUCCESS").SumAsync(p => (decimal?)p.Amount) ?? 0m;

        return new PlatformAdminStatsDto(totalCompanies, newThisWeek, newThisMonth, trialingCount, activePaidCount, totalRevenue);
    }

    // ── Courier catalog ──────────────────────────────────────────────────────

    public async Task<List<CourierCatalogDto>> GetCourierCatalogAsync()
    {
        var inUseIds = (await _db.Couriers.IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null && c.CourierCatalogId != null)
            .Select(c => c.CourierCatalogId!.Value)
            .Distinct()
            .ToListAsync())
            .ToHashSet();

        var catalog = await _db.CourierCatalogs.AsNoTracking().OrderBy(c => c.Name).ToListAsync();

        return catalog.Select(c => new CourierCatalogDto(
            c.Id, c.Name, c.InsideDhakaCharge, c.OutsideDhakaCharge, c.ReturnCharge,
            c.CodFeeType, c.CodFeeValue, c.TrackingUrlTemplate, c.IsActive,
            inUseIds.Contains(c.Id)
        )).ToList();
    }

    public async Task<CourierCatalogDto> CreateCourierCatalogAsync(CourierCatalogRequest request)
    {
        var entry = new CourierCatalog
        {
            Name = request.Name.Trim(),
            InsideDhakaCharge = request.InsideDhakaCharge,
            OutsideDhakaCharge = request.OutsideDhakaCharge,
            ReturnCharge = request.ReturnCharge,
            CodFeeType = request.CodFeeType,
            CodFeeValue = request.CodFeeValue,
            TrackingUrlTemplate = request.TrackingUrlTemplate?.Trim(),
            IsActive = request.IsActive
        };
        _db.CourierCatalogs.Add(entry);
        await _db.SaveChangesAsync();

        // Backfill every existing business with this courier too — businesses have no "add from
        // catalog" step of their own (see Courier auto-provisioning in AuthService.CompleteSignupAsync
        // for new businesses); a new active catalog entry needs to reach existing ones the same way.
        if (entry.IsActive)
        {
            var businessIds = await _db.Businesses.Select(b => b.Id).ToListAsync();
            foreach (var businessId in businessIds)
            {
                _db.Couriers.Add(new Courier
                {
                    BusinessId = businessId,
                    CourierCatalogId = entry.Id,
                    Name = entry.Name,
                    InsideDhakaCharge = entry.InsideDhakaCharge,
                    OutsideDhakaCharge = entry.OutsideDhakaCharge,
                    ReturnCharge = entry.ReturnCharge,
                    CodFeeType = entry.CodFeeType,
                    CodFeeValue = entry.CodFeeValue,
                    TrackingUrlTemplate = entry.TrackingUrlTemplate,
                    IsActive = true
                });
            }
            await _db.SaveChangesAsync();
        }

        return new CourierCatalogDto(
            entry.Id, entry.Name, entry.InsideDhakaCharge, entry.OutsideDhakaCharge, entry.ReturnCharge,
            entry.CodFeeType, entry.CodFeeValue, entry.TrackingUrlTemplate, entry.IsActive, false
        );
    }

    public async Task UpdateCourierCatalogAsync(Guid id, CourierCatalogRequest request)
    {
        var entry = await _db.CourierCatalogs.FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Courier catalog entry not found.");
        if (await IsCourierCatalogInUseAsync(id))
            throw new InvalidOperationException("This courier is already in use by a business — it cannot be edited.");

        entry.Name = request.Name.Trim();
        entry.InsideDhakaCharge = request.InsideDhakaCharge;
        entry.OutsideDhakaCharge = request.OutsideDhakaCharge;
        entry.ReturnCharge = request.ReturnCharge;
        entry.CodFeeType = request.CodFeeType;
        entry.CodFeeValue = request.CodFeeValue;
        entry.TrackingUrlTemplate = request.TrackingUrlTemplate?.Trim();
        entry.IsActive = request.IsActive;
        await _db.SaveChangesAsync();
    }

    public async Task DeleteCourierCatalogAsync(Guid id)
    {
        var entry = await _db.CourierCatalogs.FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new KeyNotFoundException("Courier catalog entry not found.");
        if (await IsCourierCatalogInUseAsync(id))
            throw new InvalidOperationException("This courier is already in use by a business — it cannot be deleted.");

        entry.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    private async Task<bool> IsCourierCatalogInUseAsync(Guid catalogId) =>
        await _db.Couriers.IgnoreQueryFilters()
            .AnyAsync(c => c.CourierCatalogId == catalogId && c.DeletedAt == null);
}
