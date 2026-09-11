using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Subscriptions;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class SubscriptionService : ISubscriptionService
{
    private const int TrialDays = 90;

    private readonly AppDbContext _db;
    private readonly IBkashPaymentService _bkash;

    public SubscriptionService(AppDbContext db, IBkashPaymentService bkash)
    {
        _db = db;
        _bkash = bkash;
    }

    public async Task StartTrialAsync(Guid companyId)
    {
        if (await _db.Subscriptions.AnyAsync(s => s.CompanyId == companyId))
            return;

        var trialPlan = await _db.SubscriptionPlans.FirstAsync(p => p.Code == "TRIAL");
        _db.Subscriptions.Add(new Subscription
        {
            CompanyId = companyId,
            PlanId = trialPlan.Id,
            Status = "TRIALING",
            BillingCycle = "MONTHLY",
            TrialEndsAt = DateTime.UtcNow.AddDays(TrialDays)
        });
        await _db.SaveChangesAsync();
    }

    public async Task<List<SubscriptionPlanDto>> GetPurchasablePlansAsync()
    {
        return await _db.SubscriptionPlans
            .Where(p => p.IsPurchasable && p.IsActive)
            .OrderBy(p => p.PriceMonthly)
            .Select(p => new SubscriptionPlanDto(p.Id, p.Code, p.Name, p.StaffSeatLimit, p.BranchLimit, p.PriceMonthly, p.PriceYearly))
            .ToListAsync();
    }

    public async Task<SubscriptionStatusDto> GetStatusAsync(Guid companyId)
    {
        var sub = await GetOrThrowAsync(companyId);
        var (staffUsed, branchesUsed) = await GetUsageAsync(companyId);

        return new SubscriptionStatusDto(
            sub.Status,
            sub.Plan.Code,
            sub.Plan.Name,
            sub.BillingCycle,
            sub.TrialEndsAt,
            sub.CurrentPeriodEnd,
            sub.Plan.StaffSeatLimit,
            staffUsed,
            sub.Plan.BranchLimit,
            branchesUsed,
            IsExpired(sub));
    }

    public async Task EnsureCanAddStaffAsync(Guid companyId)
    {
        var sub = await GetOrThrowAsync(companyId);
        var (staffUsed, _) = await GetUsageAsync(companyId);
        if (staffUsed >= sub.Plan.StaffSeatLimit)
            throw new SubscriptionLimitException(
                $"Your {sub.Plan.Name} plan allows up to {sub.Plan.StaffSeatLimit} staff seat(s). Upgrade your plan to add more.");
    }

    public async Task EnsureCanAddBranchAsync(Guid companyId)
    {
        var sub = await GetOrThrowAsync(companyId);
        var (_, branchesUsed) = await GetUsageAsync(companyId);
        if (branchesUsed >= sub.Plan.BranchLimit)
            throw new SubscriptionLimitException(
                $"Your {sub.Plan.Name} plan allows up to {sub.Plan.BranchLimit} branch(es). Upgrade your plan to add more.");
    }

    public async Task<bool> IsReadOnlyLockedAsync(Guid companyId)
    {
        var sub = await _db.Subscriptions.AsNoTracking().FirstOrDefaultAsync(s => s.CompanyId == companyId);
        return sub is null || IsExpired(sub);
    }

    public async Task<StartCheckoutResponse> StartCheckoutAsync(Guid companyId, StartCheckoutRequest request)
    {
        var sub = await _db.Subscriptions.FirstOrDefaultAsync(s => s.CompanyId == companyId)
            ?? throw new InvalidOperationException("No subscription found for this business.");

        var plan = await _db.SubscriptionPlans.FirstOrDefaultAsync(p => p.Code == request.PlanCode && p.IsPurchasable && p.IsActive)
            ?? throw new InvalidOperationException($"Unknown plan code '{request.PlanCode}'.");

        var billingCycle = request.BillingCycle == "YEARLY" ? "YEARLY" : "MONTHLY";
        var amount = billingCycle == "YEARLY" ? plan.PriceYearly : plan.PriceMonthly;
        var invoiceNumber = $"SUB-{companyId:N}-{DateTime.UtcNow:yyyyMMddHHmmss}";

        var checkout = await _bkash.CreatePaymentAsync(amount, invoiceNumber);

        _db.SubscriptionPayments.Add(new SubscriptionPayment
        {
            SubscriptionId = sub.Id,
            Amount = amount,
            Method = "BKASH",
            Status = "PENDING",
            GatewayPaymentId = checkout.PaymentId
        });

        sub.PendingPlanId = plan.Id;
        sub.PendingBillingCycle = billingCycle;
        await _db.SaveChangesAsync();

        return new StartCheckoutResponse(checkout.PaymentId, checkout.BkashRedirectUrl);
    }

    public async Task HandleBkashCallbackAsync(string paymentId, string bkashStatus)
    {
        var payment = await _db.SubscriptionPayments
            .Include(p => p.Subscription)
            .FirstOrDefaultAsync(p => p.GatewayPaymentId == paymentId)
            ?? throw new InvalidOperationException("Unknown bKash payment reference.");

        if (payment.Status != "PENDING")
            return; // already processed — bKash may redirect/retry the callback

        if (!string.Equals(bkashStatus, "success", StringComparison.OrdinalIgnoreCase))
        {
            payment.Status = "FAILED";
            await _db.SaveChangesAsync();
            return;
        }

        var result = await _bkash.ExecutePaymentAsync(paymentId);
        if (!result.Success)
        {
            payment.Status = "FAILED";
            await _db.SaveChangesAsync();
            return;
        }

        payment.Status = "SUCCESS";
        payment.GatewayTrxId = result.TrxId;
        payment.PaidAt = DateTime.UtcNow;

        var sub = payment.Subscription;
        sub.PlanId = sub.PendingPlanId ?? sub.PlanId;
        sub.BillingCycle = sub.PendingBillingCycle ?? sub.BillingCycle;
        sub.Status = "ACTIVE";
        sub.CurrentPeriodStart = DateTime.UtcNow;
        sub.CurrentPeriodEnd = sub.BillingCycle == "YEARLY" ? DateTime.UtcNow.AddYears(1) : DateTime.UtcNow.AddMonths(1);
        sub.PendingPlanId = null;
        sub.PendingBillingCycle = null;

        await _db.SaveChangesAsync();
    }

    public async Task ExpireDueSubscriptionsAsync()
    {
        var now = DateTime.UtcNow;

        var expiredTrials = await _db.Subscriptions
            .Where(s => s.Status == "TRIALING" && s.TrialEndsAt != null && s.TrialEndsAt < now)
            .ToListAsync();
        foreach (var s in expiredTrials) s.Status = "EXPIRED";

        var lapsedActive = await _db.Subscriptions
            .Where(s => s.Status == "ACTIVE" && s.CurrentPeriodEnd != null && s.CurrentPeriodEnd < now)
            .ToListAsync();
        foreach (var s in lapsedActive) s.Status = "PAST_DUE";

        if (expiredTrials.Count > 0 || lapsedActive.Count > 0)
            await _db.SaveChangesAsync();
    }

    private async Task<Subscription> GetOrThrowAsync(Guid companyId)
    {
        try
        {
            var sub = await _db.Subscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.CompanyId == companyId);

            if (sub is null)
                throw new InvalidOperationException("No subscription found for this business.");

            return sub;
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException("Failed to load subscription for this business.", ex);
        }
    }

    private async Task<(int staffUsed, int branchesUsed)> GetUsageAsync(Guid companyId)
    {
        var staffUsed = await _db.Users.CountAsync(u => u.CompanyId == companyId && u.IsActive);
        var branchesUsed = await _db.Branches.IgnoreQueryFilters()
            .CountAsync(b => b.Business.CompanyId == companyId && b.IsActive && b.DeletedAt == null);
        return (staffUsed, branchesUsed);
    }

    public static bool IsExpired(Subscription sub)
    {
        if (sub.Status is "EXPIRED" or "PAST_DUE" or "CANCELED") return true;
        if (sub.Status == "TRIALING" && sub.TrialEndsAt is { } trialEnd && trialEnd < DateTime.UtcNow) return true;
        if (sub.Status == "ACTIVE" && sub.CurrentPeriodEnd is { } periodEnd && periodEnd < DateTime.UtcNow) return true;
        return false;
    }
}
