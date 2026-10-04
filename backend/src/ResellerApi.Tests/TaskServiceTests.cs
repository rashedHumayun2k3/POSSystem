using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class TaskServiceTests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context) : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var e in ChangeTracker.Entries<BaseEntity>().Where(e => e.State is EntityState.Added or EntityState.Modified))
                e.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }
    private sealed class Fixture : IDisposable
    {
        public readonly BusinessContext Business = new() { CurrentBusinessId = Guid.NewGuid() };
        public readonly TestDb Db;
        public readonly HttpContextAccessor Http = new() { HttpContext = new DefaultHttpContext() };
        public readonly TaskService Service;
        public User Owner = null!, Manager = null!, Partner = null!, Other = null!, Staff = null!;
        public Fixture()
        {
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, Business);
            Service = new(Db, new CurrentUserService(Http), Business);
        }
        public async Task Init()
        {
            var co = new Company { Name = "Test tenant" }; Db.Companies.Add(co);
            Db.Businesses.Add(new Business { Id = Business.CurrentBusinessId, CompanyId = co.Id, Name = "Test shop", Currency = "BDT" });
            Owner = Add("Management", Roles.Owner, co.Id); Manager = Add("Manager", Roles.Manager, co.Id);
            Partner = Add("Partner", Roles.Partner, co.Id); Other = Add("Other", Roles.Manager, co.Id); Staff = Add("Staff", Roles.Staff, co.Id);
            await Db.SaveChangesAsync(); As(Owner);
        }
        private User Add(string name, string role, Guid company)
        {
            var user = new User { Name = name, Phone = Guid.NewGuid().ToString(), PasswordHash = "test", Role = role, CompanyId = company };
            Db.Users.Add(user); Db.BusinessUsers.Add(new BusinessUser { BusinessId = Business.CurrentBusinessId, UserId = user.Id }); return user;
        }
        public void As(User user) => Http.HttpContext!.User = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Role, user.Role)], "test"));
        public Task<TaskDto> Create(User assignee, string title = "Follow up") => Service.Create(new(title, "Details", assignee.Id, null));
        public void Dispose() => Db.Dispose();
    }
    private static JsonElement Json(object value) => JsonSerializer.SerializeToElement(value);

    [Fact]
    public async Task EligibleRolesCanCreateAndAssignEachOtherAndSelf()
    {
        using var f = new Fixture(); await f.Init();
        foreach (var creator in new[] { f.Owner, f.Manager, f.Partner })
        foreach (var assignee in new[] { f.Owner, f.Manager, f.Partner })
        {
            f.As(creator); var task = await f.Create(assignee);
            Assert.Equal(creator.Id, task.CreatorId); Assert.Equal(assignee.Id, task.AssigneeId); Assert.Equal("TODO", task.Status);
            Assert.Equal("NORMAL", task.Priority); Assert.False(task.Overdue);
        }
        Assert.Equal(9, await f.Db.WorkTasks.CountAsync());
        Assert.Equal(6, await f.Db.TaskNotifications.CountAsync());
        f.As(f.Staff); await Assert.ThrowsAsync<TaskAccessException>(() => f.Create(f.Manager));
    }
    [Fact]
    public async Task VisibilityCountsHistoryAndNotificationsFollowCurrentAssignment()
    {
        using var f = new Fixture(); await f.Init(); f.As(f.Manager); var task = await f.Create(f.Partner);
        f.As(f.Other);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Detail(task.Id));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Entries(task.Id, 1));
        await Assert.ThrowsAsync<TaskAccessException>(() => f.Service.List(new(View: "all")));
        Assert.Equal(0, Json(await f.Service.List(new())).GetProperty("Counts").GetProperty("Pending").GetInt32());
        f.As(f.Partner); task = await f.Service.Comment(task.Id, new("Called supplier\nWaiting for reply", task.RowVer));
        Assert.Equal("TODO", task.Status);
        var oldNotification = await f.Db.TaskNotifications.FirstAsync(x => x.RecipientId == f.Partner.Id);
        f.As(f.Manager); task = await f.Service.Edit(task.Id, new(task.Title, task.Description, f.Other.Id, null, RowVer: task.RowVer));
        Assert.Equal(3, await f.Db.TaskEntries.CountAsync());
        f.As(f.Partner);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Detail(task.Id));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Comment(task.Id, new("Lost access", task.RowVer)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.ReadNotification(oldNotification.Id));
        Assert.Equal(0, Json(await f.Service.Notifications(1)).GetProperty("Total").GetInt32());
        f.As(f.Other); Assert.Equal(task.Id, (await f.Service.Detail(task.Id)).Id);
    }
    [Fact]
    public async Task BroaderViewDoesNotGrantEditOrCommentAndGrantsAreBusinessScoped()
    {
        using var f = new Fixture(); await f.Init(); f.As(f.Manager); var task = await f.Create(f.Partner);
        f.As(f.Owner); await f.Service.SetPermissions(f.Other.Id, new(true, false, false));
        f.As(f.Other); var detail = await f.Service.Detail(task.Id);
        Assert.False(detail.CanEdit); Assert.False(detail.CanComment); Assert.False(detail.CanChangeStatus);
        await Assert.ThrowsAsync<TaskAccessException>(() => f.Service.Edit(task.Id, new("Oops", null, f.Other.Id, null, RowVer: task.RowVer)));
        await Assert.ThrowsAsync<TaskAccessException>(() => f.Service.Comment(task.Id, new("No permission", task.RowVer)));
        await Assert.ThrowsAsync<TaskAccessException>(() => f.Service.SetPermissions(f.Other.Id, new(true, true, true)));
        f.As(f.Owner); await f.Service.SetPermissions(f.Other.Id, new(true, true, false));
        f.As(f.Other); task = await f.Service.Comment(task.Id, new("Permitted", task.RowVer));
        Assert.Equal("TODO", task.Status);
        f.As(f.Owner); await f.Service.SetPermissions(f.Other.Id, new(false, false, true));
        f.As(f.Other); task = await f.Service.Edit(task.Id, new("Managed", null, f.Partner.Id, null, RowVer: task.RowVer));
        Assert.Equal("Managed", task.Title);
    }
    [Fact]
    public async Task CrossBusinessAccessAssignmentAndInactiveUsersAreBlocked()
    {
        using var f = new Fixture(); await f.Init(); var task = await f.Create(f.Manager);
        f.Partner.IsActive = false; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<ArgumentException>(() => f.Create(f.Partner));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Create(f.Staff));
        var originalBusiness = f.Business.CurrentBusinessId;
        var foreign = new User { Name = "Foreign", Phone = "foreign", PasswordHash = "test", Role = Roles.Manager, CompanyId = Guid.NewGuid() };
        f.Db.Users.Add(foreign); var foreignBusiness = Guid.NewGuid();
        f.Db.BusinessUsers.Add(new BusinessUser { BusinessId = foreignBusiness, UserId = foreign.Id }); await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<ArgumentException>(() => f.Create(foreign));
        f.Business.CurrentBusinessId = foreignBusiness; f.As(foreign);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Detail(task.Id));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Edit(task.Id, new("Changed", null, foreign.Id, null, RowVer: task.RowVer)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => f.Service.Entries(task.Id, 1));
        f.As(f.Owner); await Assert.ThrowsAsync<TaskAccessException>(() => f.Service.List(new()));
        f.Business.CurrentBusinessId = originalBusiness; f.As(f.Partner);
        await Assert.ThrowsAsync<TaskAccessException>(() => f.Service.Permissions());
    }
    [Fact]
    public async Task StatusCompletionCancellationReopenAndHistoryArePreserved()
    {
        using var f = new Fixture(); await f.Init(); f.As(f.Manager); var task = await f.Create(f.Partner);
        await Assert.ThrowsAsync<TaskAccessException>(() => f.Service.ChangeStatus(task.Id, new("DONE", task.RowVer)));
        f.As(f.Partner); task = await f.Service.ChangeStatus(task.Id, new("IN_PROGRESS", task.RowVer));
        task = await f.Service.ChangeStatus(task.Id, new("TODO", task.RowVer));
        task = await f.Service.ChangeStatus(task.Id, new("DONE", task.RowVer, "Delivered successfully"));
        Assert.Equal(f.Partner.Id, task.CompletedById); Assert.NotNull(task.CompletedAt);
        Assert.Single(await f.Db.TaskEntries.Where(x => x.Message.Contains("Delivered successfully")).ToListAsync());
        await Assert.ThrowsAsync<TaskAccessException>(() => f.Service.ChangeStatus(task.Id, new("REOPEN", task.RowVer)));
        f.As(f.Manager);
        await Assert.ThrowsAsync<ArgumentException>(() => f.Service.Edit(task.Id, new("Closed", null, f.Manager.Id, null, RowVer: task.RowVer)));
        task = await f.Service.ChangeStatus(task.Id, new("REOPEN", task.RowVer)); Assert.Null(task.CompletedAt); Assert.Null(task.CompletedById);
        task = await f.Service.ChangeStatus(task.Id, new("CANCELLED", task.RowVer));
        task = await f.Service.ChangeStatus(task.Id, new("REOPEN", task.RowVer)); Assert.Equal("TODO", task.Status);
        Assert.Equal(7, await f.Db.TaskEntries.CountAsync());
        Assert.Single(await f.Db.TaskNotifications.Where(x => x.RecipientId == f.Manager.Id && x.Message.StartsWith("Completed:")).ToListAsync());
    }
    [Fact]
    public async Task CommentsPersistChronologicallyDeduplicateRecipientsAndRejectStaleVersions()
    {
        using var f = new Fixture(); await f.Init(); f.As(f.Manager); var task = await f.Create(f.Manager);
        var oldVersion = task.RowVer;
        await Assert.ThrowsAsync<ArgumentException>(() => f.Service.Comment(task.Id, new(" \n ", task.RowVer)));
        task = await f.Service.Comment(task.Id, new("First\nSecond line", task.RowVer));
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => f.Service.Edit(task.Id, new("Stale", null, f.Manager.Id, null, RowVer: oldVersion)));
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => f.Service.Comment(task.Id, new("Stale", oldVersion)));
        f.As(f.Owner); task = await f.Service.Comment(task.Id, new("Owner comment", task.RowVer));
        Assert.Single(await f.Db.TaskNotifications.ToListAsync());
        Assert.Equal(f.Manager.Id, (await f.Db.TaskNotifications.SingleAsync()).RecipientId);
        f.Db.ChangeTracker.Clear();
        var entries = Json(await f.Service.Entries(task.Id, 1)).GetProperty("Items");
        Assert.Equal(3, entries.GetArrayLength()); Assert.Equal("First\nSecond line", entries[1].GetProperty("Message").GetString());
        Assert.Equal("Owner comment", entries[2].GetProperty("Message").GetString());
        Assert.Equal("TODO", (await f.Service.Detail(task.Id)).Status);
    }
    [Fact]
    public async Task SortingCountsAndUtcDueDatesUseActiveTasksOnly()
    {
        using var f = new Fixture(); await f.Init();
        var undated = await f.Create(f.Owner, "Undated");
        var future = await f.Service.Create(new("Future urgent", null, f.Owner.Id, DateTimeOffset.UtcNow.AddDays(2), "URGENT"));
        var late = await f.Service.Create(new("Late normal", null, f.Owner.Id, DateTimeOffset.UtcNow.AddDays(-2)));
        var urgent = await f.Service.Create(new("Late urgent", null, f.Owner.Id, DateTimeOffset.UtcNow.AddDays(-1), "URGENT"));
        var done = await f.Service.Create(new("Done", null, f.Owner.Id, DateTimeOffset.UtcNow.AddDays(-3)));
        done = await f.Service.ChangeStatus(done.Id, new("DONE", done.RowVer)); Assert.False(done.Overdue);
        var result = Json(await f.Service.List(new())); var rows = result.GetProperty("Items");
        Assert.Equal(urgent.Id, rows[0].GetProperty("Id").GetGuid()); Assert.Equal(late.Id, rows[1].GetProperty("Id").GetGuid());
        Assert.Equal(future.Id, rows[2].GetProperty("Id").GetGuid()); Assert.Equal(undated.Id, rows[3].GetProperty("Id").GetGuid());
        Assert.Equal(4, result.GetProperty("Counts").GetProperty("Pending").GetInt32()); Assert.Equal(2, result.GetProperty("Counts").GetProperty("Overdue").GetInt32()); Assert.Equal(1, result.GetProperty("Counts").GetProperty("Done").GetInt32());
        var local = new DateTimeOffset(2030, 1, 2, 9, 30, 0, TimeSpan.FromHours(6));
        var zoned = await f.Service.Create(new("Dhaka", null, f.Owner.Id, local)); Assert.Equal(local.UtcDateTime, zoned.DueAt); Assert.Equal(DateTimeKind.Utc, zoned.DueAt!.Value.Kind);
    }
}
