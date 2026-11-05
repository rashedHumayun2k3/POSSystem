using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Services;

public record RegisterPushDevice(string Token, string RefreshToken, string Language = "bn");

public class OrderNotificationService(AppDbContext db, ICurrentUserService user, IBusinessContext business)
{
    // Use current database permissions, not a possibly stale JWT role, at delivery/read time.
    public static IQueryable<BusinessUser> Recipients(AppDbContext db, Guid businessId, Guid? branchId) =>
        db.BusinessUsers.IgnoreQueryFilters().Where(m => m.BusinessId == businessId &&
            m.Business.DeletedAt == null && m.User.DeletedAt == null && m.User.IsActive &&
            (m.User.Role == Roles.Owner || m.User.Role == Roles.Manager || m.User.Role == Roles.Partner ||
             ((m.User.Role == Roles.Staff || m.User.Role == Roles.Warehouse) && branchId != null &&
              db.UserBranches.Any(b => b.UserId == m.UserId && b.BranchId == branchId))));

    private IQueryable<OrderNotification> Visible() => db.OrderNotifications.Where(n =>
        n.RecipientId == user.UserId && n.BusinessId == business.CurrentBusinessId &&
        (business.CurrentBranchId == null || n.BranchId == business.CurrentBranchId) &&
        db.Orders.IgnoreQueryFilters().Any(o => o.Id == n.OrderId && o.DeletedAt == null) &&
        db.BusinessUsers.IgnoreQueryFilters().Any(m => m.BusinessId == n.BusinessId && m.UserId == user.UserId &&
            m.Business.DeletedAt == null && m.User.DeletedAt == null && m.User.IsActive &&
            (m.User.Role == Roles.Owner || m.User.Role == Roles.Manager || m.User.Role == Roles.Partner ||
             ((m.User.Role == Roles.Staff || m.User.Role == Roles.Warehouse) && n.BranchId != null &&
              db.UserBranches.Any(b => b.UserId == m.UserId && b.BranchId == n.BranchId)))));

    public async Task<object> List(int page)
    {
        page = Math.Clamp(page, 1, 10000);
        var query = Visible().AsNoTracking();
        var unread = await query.CountAsync(n => n.ReadAt == null);
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(n => n.CreatedAt).ThenBy(n => n.Id)
            .Skip((page - 1) * 25).Take(25).ToListAsync();
        return new { unread, total, items = items.Select(n => new { n.Id, n.OrderId, n.OrderNo, n.BusinessId, n.BranchId,
            CreatedAt = DateTime.SpecifyKind(n.CreatedAt, DateTimeKind.Utc), n.ReadAt }) };
    }

    public async Task<object> Read(Guid id)
    {
        var notification = await Visible().FirstOrDefaultAsync(n => n.Id == id)
            ?? throw new KeyNotFoundException("Notification not found.");
        notification.ReadAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync();
        return new { notification.OrderId };
    }

    public async Task Register(RegisterPushDevice input)
    {
        if (input.Token is null || !Regex.IsMatch(input.Token, @"^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$"))
            throw new ArgumentException("Invalid Expo push token.");
        if (input.Language is not ("en" or "bn")) throw new ArgumentException("Unsupported language.");
        if (!await Recipients(db, business.CurrentBusinessId, business.CurrentBranchId).AnyAsync(m => m.UserId == user.UserId))
            throw new UnauthorizedAccessException("Notification access denied.");
        var session = await db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == input.RefreshToken && t.UserId == user.UserId && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow)
            ?? throw new UnauthorizedAccessException("Sign in again to enable notifications.");
        var device = await db.PushDevices.SingleOrDefaultAsync(d => d.Token == input.Token);
        if (device == null) { device = new PushDevice { Token = input.Token }; db.PushDevices.Add(device); }
        device.UserId = user.UserId; device.BusinessId = business.CurrentBusinessId; device.BranchId = business.CurrentBranchId;
        device.RefreshTokenId = session.Id; device.Language = input.Language; device.Enabled = true; device.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task Disable(string token)
    {
        var device = await db.PushDevices.SingleOrDefaultAsync(d => d.Token == token && d.UserId == user.UserId);
        if (device != null) { device.Enabled = false; await db.SaveChangesAsync(); }
    }
}
