using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Orders;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly ICustomerService _svc;

    public CustomersController(ICustomerService svc)
    {
        _svc = svc;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q)
        => Ok(await _svc.ListAsync(q));

    [HttpGet("cache")]
    public async Task<IActionResult> Cache()
        => Ok(await _svc.ListForCacheAsync());

    [HttpGet("by-phone")]
    public async Task<IActionResult> ByPhone([FromQuery] string phone)
    {
        var c = await _svc.FindByPhoneAsync(phone);
        if (c == null) return NotFound();
        return Ok(c);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
        => Ok(await _svc.GetAsync(id));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request,
        [FromServices] Infrastructure.ICurrentUserService user)
        => Ok(await _svc.UpdateAsync(id, request, user.UserId));
}
