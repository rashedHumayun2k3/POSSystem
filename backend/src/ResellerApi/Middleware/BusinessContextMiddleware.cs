using System.Security.Claims;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ResellerApi.Middleware;

public class BusinessContextMiddleware
{
    private readonly RequestDelegate _next;

    public BusinessContextMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, BusinessContext businessContext, AppDbContext db)
    {
        var path = context.Request.Path.Value ?? "";

        // Skip auth endpoints — they don't need a business context. Skip platform-admin routes too —
        // that JWT is cross-tenant by design (no company_id/business membership at all), so it can
        // never satisfy the BusinessUsers check below. Skip ClientPage routes too — a logged-in
        // CLIENTPAGE_CUSTOMER JWT (product reviews) is also cross-tenant (one shopper reviews
        // products across many shops) and, once authenticated, would otherwise trip the
        // X-Business-Id requirement below even though the ClientPage frontend never sends that
        // header (it resolves its own per-request shop via ClientPageShopContextMiddleware
        // instead). Skip the SignalR hub too — it authenticates via JWT same as everything else,
        // but scopes itself per-business via the JoinBusiness(businessId) RPC (Hubs/LiveHub.cs)
        // after connecting, not an X-Business-Id header — SignalR's own negotiate/connect
        // requests never carry that header.
        if (path.StartsWith("/api/v1/auth", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/v1/health", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/v1/platform-admin", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/v1/clientpage", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/hubs", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        if (!context.User.Identity?.IsAuthenticated ?? true)
        {
            await _next(context);
            return;
        }

        var businessIdHeader = context.Request.Headers["X-Business-Id"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(businessIdHeader) || !Guid.TryParse(businessIdHeader, out var businessId))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { code = "MISSING_BUSINESS_ID", message = "X-Business-Id header is required." });
            return;
        }

        var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var hasAccess = await db.BusinessUsers
            .AsNoTracking()
            .AnyAsync(bu => bu.BusinessId == businessId && bu.UserId == userId);

        if (!hasAccess)
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new { code = "BUSINESS_ACCESS_DENIED", message = "You do not have access to this business." });
            return;
        }

        businessContext.CurrentBusinessId = businessId;

        var branchIdHeader = context.Request.Headers["X-Branch-Id"].FirstOrDefault();
        var role = context.User.FindFirstValue(ClaimTypes.Role);
        var isOwnerOrManager = role == Roles.Owner || role == Roles.Manager || role == Roles.Partner;

        // /api/v1/branches (list/mine) must be reachable before a branch is chosen — that's
        // exactly what a STAFF/WAREHOUSE user calls right after login to find out which
        // branch(es) they're assigned to.
        var branchDiscoveryEndpoint = path.StartsWith("/api/v1/branches", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(branchIdHeader))
        {
            if (!isOwnerOrManager && !branchDiscoveryEndpoint)
            {
                context.Response.StatusCode = 400;
                await context.Response.WriteAsJsonAsync(new { code = "MISSING_BRANCH_ID", message = "X-Branch-Id header is required." });
                return;
            }

            businessContext.CurrentBranchId = null; // OWNER/MANAGER "all branches" mode
        }
        else
        {
            if (!Guid.TryParse(branchIdHeader, out var branchId))
            {
                context.Response.StatusCode = 400;
                await context.Response.WriteAsJsonAsync(new { code = "INVALID_BRANCH_ID", message = "X-Branch-Id is not a valid GUID." });
                return;
            }

            // OWNER/MANAGER can select any branch in the business (they oversee everything,
            // so requiring an explicit per-branch assignment row would just be busywork).
            // STAFF/WAREHOUSE must be explicitly assigned via UserBranches.
            var branchAccess = isOwnerOrManager
                ? await db.Branches.AsNoTracking().AnyAsync(b => b.Id == branchId)
                : await db.UserBranches.AsNoTracking().AnyAsync(ub => ub.BranchId == branchId && ub.UserId == userId);
            if (!branchAccess)
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new { code = "BRANCH_ACCESS_DENIED", message = "You do not have access to this branch." });
                return;
            }

            businessContext.CurrentBranchId = branchId;
        }

        await _next(context);
    }
}
