using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;

namespace ResellerApi.Services;

public record TaskInput(string Title, string? Description, Guid AssigneeId, DateTimeOffset? DueAt, string Priority = "NORMAL", string? RowVer = null);
public record TaskAction(string Status, string RowVer, string? Note = null);
public record TaskComment(string Message, string RowVer);
public record TaskPermissions(bool CanCreate, bool CanViewAll, bool CanCommentAll, bool CanManageAll, bool CanConfigure);
public record TaskPermissionInput(bool CanViewAllTasks, bool CanCommentAllTasks, bool CanManageAllTasks);
public record TaskQuery(string View = "mine", string Status = "ACTIVE", string? Search = null, string? Priority = null, Guid? AssigneeId = null, Guid? CreatorId = null, int Page = 1, int PageSize = 25);
public record TaskDto(Guid Id, string Title, string? Description, Guid CreatorId, string Creator, Guid AssigneeId, string Assignee,
    DateTime CreatedAt, DateTime UpdatedAt, DateTime? DueAt, string Priority, string Status, bool Overdue,
    Guid? CompletedById, string? CompletedBy, DateTime? CompletedAt, string RowVer, bool CanEdit, bool CanChangeStatus, bool CanReopen, bool CanComment);
public sealed class TaskAccessException(string message) : Exception(message);

public class TaskService(AppDbContext db, ICurrentUserService current, IBusinessContext business)
{
    public static bool Eligible(string role) => role is Roles.Owner or Roles.Manager or Roles.Partner;
    public static bool Active(string status) => status is "TODO" or "IN_PROGRESS";
    public static bool Overdue(WorkTask task, DateTime now) => Active(task.Status) && task.DueAt < now;
    private async Task<BusinessUser> Member()
    {
        var member = await db.BusinessUsers.Include(x => x.User).FirstOrDefaultAsync(x =>
            x.BusinessId == business.CurrentBusinessId && x.UserId == current.UserId && x.User.IsActive);
        if (member == null || !Eligible(member.User.Role)) throw new TaskAccessException("Tasks are available to active management, managers and partners in this business.");
        return member;
    }
    public async Task<TaskPermissions> Permissions()
    {
        var m = await Member();
        var owner = m.User.Role == Roles.Owner;
        return new(true, owner || m.CanViewAllTasks || m.CanManageAllTasks, owner || m.CanCommentAllTasks,
            owner || m.CanManageAllTasks, owner);
    }
    private IQueryable<WorkTask> Visible(TaskPermissions p) => db.WorkTasks.Where(x =>
        p.CanViewAll || x.CreatorId == current.UserId || x.AssigneeId == current.UserId);
    private async Task<WorkTask> Find(Guid id, TaskPermissions p) => await Visible(p)
        .Include(x => x.Creator).Include(x => x.Assignee).Include(x => x.CompletedBy)
        .FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Task not found or no longer accessible.");
    private TaskDto Dto(WorkTask t, TaskPermissions p) => new(t.Id, t.Title, t.Description, t.CreatorId, t.Creator.Name,
        t.AssigneeId, t.Assignee.Name, Utc(t.CreatedAt), Utc(t.UpdatedAt), t.DueAt.HasValue ? Utc(t.DueAt.Value) : null,
        t.Priority, t.Status, Overdue(t, DateTime.UtcNow), t.CompletedById, t.CompletedBy?.Name,
        t.CompletedAt.HasValue ? Utc(t.CompletedAt.Value) : null, Convert.ToBase64String(t.RowVer),
        Active(t.Status) && (p.CanManageAll || t.CreatorId == current.UserId),
        Active(t.Status) && (p.CanManageAll || t.AssigneeId == current.UserId),
        !Active(t.Status) && (p.CanManageAll || t.CreatorId == current.UserId),
        p.CanCommentAll || p.CanManageAll || t.CreatorId == current.UserId || t.AssigneeId == current.UserId);
    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
    private static string DueLabel(DateTime? value) => value.HasValue ? DhakaTime.UtcToLocal(value.Value).ToString("yyyy-MM-dd HH:mm") + " Asia/Dhaka" : "none";
    public async Task<object> Assignees()
    {
        await Member();
        return await EligibleUsers().OrderBy(x => x.User.Name).Select(x => new { x.User.Id, x.User.Name, x.User.Role }).ToListAsync();
    }
    private IQueryable<BusinessUser> EligibleUsers() => db.BusinessUsers.Where(x => x.BusinessId == business.CurrentBusinessId &&
        x.User.IsActive && (x.User.Role == Roles.Owner || x.User.Role == Roles.Manager || x.User.Role == Roles.Partner));
    private async Task Validate(TaskInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Title) || input.Title.Trim().Length > 200) throw new ArgumentException("Title is required and must be at most 200 characters.");
        if (input.Description?.Length > 10000) throw new ArgumentException("Description must be at most 10,000 characters.");
        if (input.Priority is not ("NORMAL" or "URGENT")) throw new ArgumentException("Choose Normal or Urgent priority.");
        if (!await EligibleUsers().AnyAsync(x => x.UserId == input.AssigneeId)) throw new ArgumentException("Choose an active management member, manager or partner in this business.");
    }
    public async Task<object> List(TaskQuery request)
    {
        var p = await Permissions();
        var q = Visible(p).AsNoTracking();
        if (request.View == "mine") q = q.Where(x => x.AssigneeId == current.UserId);
        else if (request.View == "created") q = q.Where(x => x.CreatorId == current.UserId);
        else if (request.View != "all") throw new ArgumentException("Unknown task view.");
        else if (!p.CanViewAll) throw new TaskAccessException("You do not have permission to view all tasks.");
        var now = DateTime.UtcNow;
        var counts = new {
            Pending = await q.CountAsync(x => x.Status == "TODO" || x.Status == "IN_PROGRESS"),
            Overdue = await q.CountAsync(x => (x.Status == "TODO" || x.Status == "IN_PROGRESS") && x.DueAt < now),
            Done = await q.CountAsync(x => x.Status == "DONE")
        };
        if (request.Status == "ACTIVE") q = q.Where(x => x.Status == "TODO" || x.Status == "IN_PROGRESS");
        else if (new[] { "TODO", "IN_PROGRESS", "DONE", "CANCELLED" }.Contains(request.Status)) q = q.Where(x => x.Status == request.Status);
        else throw new ArgumentException("Unknown task status.");
        if (!string.IsNullOrWhiteSpace(request.Search)) q = q.Where(x => x.Title.Contains(request.Search.Trim()));
        if (!string.IsNullOrEmpty(request.Priority)) q = q.Where(x => x.Priority == request.Priority);
        if (request.AssigneeId.HasValue) q = q.Where(x => x.AssigneeId == request.AssigneeId);
        if (request.CreatorId.HasValue) q = q.Where(x => x.CreatorId == request.CreatorId);
        var total = await q.CountAsync();
        var page = Math.Max(1, request.Page); var size = Math.Clamp(request.PageSize, 1, 100);
        var rows = await q.OrderByDescending(x => (x.Status == "TODO" || x.Status == "IN_PROGRESS") && x.DueAt < now)
            .ThenByDescending(x => x.Priority == "URGENT").ThenBy(x => x.DueAt == null).ThenBy(x => x.DueAt)
            .ThenBy(x => x.CreatedAt).ThenBy(x => x.Id).Skip((page - 1) * size).Take(size)
            .Include(x => x.Creator).Include(x => x.Assignee).Include(x => x.CompletedBy).ToListAsync();
        return new { Items = rows.Select(x => Dto(x, p)), Total = total, Page = page, PageSize = size, Counts = counts, Permissions = p };
    }
    public async Task<TaskDto> Detail(Guid id) { var p = await Permissions(); return Dto(await Find(id, p), p); }
    public async Task<object> Entries(Guid id, int page)
    {
        await Find(id, await Permissions());
        var q = db.TaskEntries.AsNoTracking().Where(x => x.TaskId == id);
        var total = await q.CountAsync();
        var rows = await q.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id).Skip((Math.Max(1, page) - 1) * 50).Take(50)
            .Select(x => new { x.Id, x.Kind, x.Message, Author = x.Actor.Name, x.CreatedAt }).ToListAsync();
        return new { Items = rows.Select(x => new { x.Id, x.Kind, x.Message, x.Author, CreatedAt = Utc(x.CreatedAt) }), Total = total };
    }
    private void CheckVersion(WorkTask task, string? version)
    {
        if (string.IsNullOrWhiteSpace(version)) throw new ArgumentException("Task version is required. Refresh and try again.");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(version); } catch (FormatException) { throw new ArgumentException("Invalid task version."); }
        if (!task.RowVer.SequenceEqual(bytes)) throw new DbUpdateConcurrencyException();
        db.Entry(task).Property(x => x.RowVer).OriginalValue = bytes;
        // Comments also touch the task row: a concurrent reassignment must invalidate their access check.
        task.UpdatedAt = DateTime.UtcNow;
        db.Entry(task).Property(x => x.UpdatedAt).IsModified = true;
    }
    private void Entry(WorkTask t, string kind, string message)
    {
        db.TaskEntries.Add(new TaskEntry { BusinessId = t.BusinessId, TaskId = t.Id, ActorId = current.UserId, Kind = kind, Message = message });
        db.ActivityLogs.Add(new ActivityLog { BusinessId = t.BusinessId, UserId = current.UserId, Action = kind,
            EntityType = "WorkTask", EntityId = t.Id, AfterJson = JsonSerializer.Serialize(new { message }) });
    }
    private async Task Notify(WorkTask task, string message, params Guid[] recipients)
    {
        var ids = recipients.Distinct().Where(x => x != current.UserId).ToArray();
        var eligible = await EligibleUsers().Where(x => ids.Contains(x.UserId)).Select(x => x.UserId).ToListAsync();
        foreach (var id in eligible) db.TaskNotifications.Add(new TaskNotification {
            BusinessId = task.BusinessId, TaskId = task.Id, RecipientId = id, Message = message });
    }
    public async Task<TaskDto> Create(TaskInput input)
    {
        var p = await Permissions(); await Validate(input);
        var task = new WorkTask { BusinessId = business.CurrentBusinessId, CreatorId = current.UserId,
            AssigneeId = input.AssigneeId, Title = input.Title.Trim(), Description = input.Description?.Trim(),
            DueAt = input.DueAt?.UtcDateTime, Priority = input.Priority };
        db.WorkTasks.Add(task); Entry(task, "CREATED", "Task created.");
        await Notify(task, $"Assigned to you: {task.Title}", task.AssigneeId);
        await db.SaveChangesAsync(); return Dto(await Find(task.Id, p), p);
    }
    public async Task<TaskDto> Edit(Guid id, TaskInput input)
    {
        var p = await Permissions(); var t = await Find(id, p);
        if (t.CreatorId != current.UserId && !p.CanManageAll) throw new TaskAccessException("Only the creator or a task administrator can edit this task.");
        if (!Active(t.Status)) throw new ArgumentException("Reopen this task before editing or reassigning it.");
        await Validate(input); CheckVersion(t, input.RowVer);
        if (t.Title != input.Title.Trim()) Entry(t, "EDITED", $"Title: {t.Title} → {input.Title.Trim()}");
        if (t.Description != input.Description?.Trim()) Entry(t, "EDITED", $"Description: {t.Description ?? "(empty)"} → {input.Description?.Trim() ?? "(empty)"}");
        if (t.Priority != input.Priority) Entry(t, "EDITED", $"Priority: {t.Priority} → {input.Priority}");
        if (t.DueAt != input.DueAt?.UtcDateTime) Entry(t, "EDITED", $"Due date: {DueLabel(t.DueAt)} → {DueLabel(input.DueAt?.UtcDateTime)}");
        if (t.AssigneeId != input.AssigneeId)
        {
            var next = await db.Users.FirstAsync(x => x.Id == input.AssigneeId);
            Entry(t, "REASSIGNED", $"Assignee: {t.Assignee.Name} ({t.AssigneeId}) → {next.Name} ({next.Id})");
            t.AssigneeId = next.Id; t.Assignee = next;
            await Notify(t, $"Reassigned to you: {input.Title.Trim()}", next.Id);
        }
        t.Title = input.Title.Trim(); t.Description = input.Description?.Trim(); t.Priority = input.Priority; t.DueAt = input.DueAt?.UtcDateTime;
        await db.SaveChangesAsync(); return Dto(t, p);
    }
    public async Task<TaskDto> ChangeStatus(Guid id, TaskAction input)
    {
        var p = await Permissions(); var t = await Find(id, p);
        var creator = t.CreatorId == current.UserId || p.CanManageAll;
        var assignee = t.AssigneeId == current.UserId || p.CanManageAll;
        if (input.Note?.Length > 5000) throw new ArgumentException("Completion note must be at most 5,000 characters.");
        var reopen = input.Status == "REOPEN";
        if (reopen ? !creator : input.Status == "CANCELLED" ? !creator : !assignee) throw new TaskAccessException("You cannot perform this task action.");
        if (reopen ? Active(t.Status) : !Active(t.Status)) throw new ArgumentException(reopen ? "Task is already active." : "Reopen this task before changing it.");
        if (!reopen && input.Status is not ("TODO" or "IN_PROGRESS" or "DONE" or "CANCELLED")) throw new ArgumentException("Unknown task action.");
        CheckVersion(t, input.RowVer);
        var next = reopen ? "TODO" : input.Status;
        if (next == t.Status) throw new ArgumentException("Task already has this status.");
        var message = $"Status: {t.Status} → {next}";
        if (next == "DONE" && !string.IsNullOrWhiteSpace(input.Note)) message += "\n" + input.Note.Trim();
        Entry(t, reopen ? "REOPENED" : next == "DONE" ? "COMPLETED" : next == "CANCELLED" ? "CANCELLED" : "STATUS_CHANGED", message);
        t.Status = next;
        t.CompletedAt = next == "DONE" ? DateTime.UtcNow : null;
        t.CompletedById = next == "DONE" ? current.UserId : null;
        t.CompletedBy = next == "DONE" ? await db.Users.FirstAsync(x => x.Id == current.UserId) : null;
        if (next == "DONE") await Notify(t, $"Completed: {t.Title}", t.CreatorId);
        await db.SaveChangesAsync(); return Dto(t, p);
    }
    public async Task<TaskDto> Comment(Guid id, TaskComment input)
    {
        var p = await Permissions(); var t = await Find(id, p);
        if (!Dto(t, p).CanComment) throw new TaskAccessException("You do not have permission to comment on this task.");
        if (string.IsNullOrWhiteSpace(input.Message) || input.Message.Length > 5000) throw new ArgumentException("Write a comment of 1–5,000 characters.");
        CheckVersion(t, input.RowVer); Entry(t, "COMMENT", input.Message.Trim());
        await Notify(t, $"New comment: {t.Title}", t.CreatorId, t.AssigneeId);
        await db.SaveChangesAsync(); return Dto(t, p);
    }
    public async Task<object> Notifications(int page)
    {
        var p = await Permissions();
        var visible = Visible(p).Select(x => x.Id);
        var q = db.TaskNotifications.AsNoTracking().Where(x => x.RecipientId == current.UserId && visible.Contains(x.TaskId));
        var unread = await q.CountAsync(x => x.ReadAt == null); var total = await q.CountAsync();
        var rows = await q.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id).Skip((Math.Max(1, page) - 1) * 25).Take(25)
            .Select(x => new { x.Id, x.TaskId, x.Message, x.CreatedAt, x.ReadAt }).ToListAsync();
        return new { Unread = unread, Total = total, Items = rows.Select(x => new { x.Id, x.TaskId, x.Message, CreatedAt = Utc(x.CreatedAt), x.ReadAt }) };
    }
    public async Task<object> ReadNotification(Guid id)
    {
        var p = await Permissions();
        var n = await db.TaskNotifications.FirstOrDefaultAsync(x => x.Id == id && x.RecipientId == current.UserId)
            ?? throw new KeyNotFoundException("Notification not found.");
        await Find(n.TaskId, p); n.ReadAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync(); return new { n.TaskId };
    }
    public async Task<object> PermissionMembers()
    {
        if (!(await Permissions()).CanConfigure) throw new TaskAccessException("Only the owner can configure task permissions.");
        return await EligibleUsers().OrderBy(x => x.User.Name).Select(x => new { x.UserId, x.User.Name, x.User.Role,
            x.CanViewAllTasks, x.CanCommentAllTasks, x.CanManageAllTasks }).ToListAsync();
    }
    public async Task<object> SetPermissions(Guid id, TaskPermissionInput input)
    {
        if (!(await Permissions()).CanConfigure) throw new TaskAccessException("Only the owner can configure task permissions.");
        var m = await EligibleUsers().FirstOrDefaultAsync(x => x.UserId == id) ?? throw new KeyNotFoundException("Eligible member not found.");
        m.CanViewAllTasks = input.CanViewAllTasks; m.CanCommentAllTasks = input.CanCommentAllTasks; m.CanManageAllTasks = input.CanManageAllTasks;
        db.ActivityLogs.Add(new ActivityLog { BusinessId = business.CurrentBusinessId, UserId = current.UserId,
            Action = "UPDATE", EntityType = "TaskPermissions", EntityId = id, AfterJson = JsonSerializer.Serialize(input) });
        await db.SaveChangesAsync(); return new { Updated = true };
    }
}
