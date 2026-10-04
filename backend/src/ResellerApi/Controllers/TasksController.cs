using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.Services;

namespace ResellerApi.Controllers;

[ApiController, Authorize, Route("api/v1/tasks")]
public class TasksController(TaskService service) : ControllerBase
{
    private async Task<IActionResult> Run<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (TaskAccessException e) { return StatusCode(403, new { message = e.Message }); }
        catch (KeyNotFoundException e) { return NotFound(new { message = e.Message }); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
    }
    [HttpGet] public Task<IActionResult> List([FromQuery] TaskQuery query) => Run(() => service.List(query));
    [HttpGet("permissions")] public Task<IActionResult> Permissions() => Run(service.Permissions);
    [HttpGet("assignees")] public Task<IActionResult> Assignees() => Run(service.Assignees);
    [HttpGet("permission-members")] public Task<IActionResult> Members() => Run(service.PermissionMembers);
    [HttpPut("permission-members/{id:guid}")] public Task<IActionResult> SetPermissions(Guid id, TaskPermissionInput input) => Run(() => service.SetPermissions(id, input));
    [HttpGet("notifications")] public Task<IActionResult> Notifications(int page = 1) => Run(() => service.Notifications(page));
    [HttpPost("notifications/{id:guid}/read")] public Task<IActionResult> Read(Guid id) => Run(() => service.ReadNotification(id));
    [HttpGet("{id:guid}")] public Task<IActionResult> Detail(Guid id) => Run(() => service.Detail(id));
    [HttpGet("{id:guid}/entries")] public Task<IActionResult> Entries(Guid id, int page = 1) => Run(() => service.Entries(id, page));
    [HttpPost] public Task<IActionResult> Create(TaskInput input) => Run(() => service.Create(input));
    [HttpPut("{id:guid}")] public Task<IActionResult> Edit(Guid id, TaskInput input) => Run(() => service.Edit(id, input));
    [HttpPost("{id:guid}/status")] public Task<IActionResult> Status(Guid id, TaskAction input) => Run(() => service.ChangeStatus(id, input));
    [HttpPost("{id:guid}/comments")] public Task<IActionResult> Comment(Guid id, TaskComment input) => Run(() => service.Comment(id, input));
}
