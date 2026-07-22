using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.Feedback;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/feedback")]
[Authorize]
public class FeedbackController : ControllerBase
{
    private readonly IFeedbackService _svc;
    private readonly ICurrentUserService _user;
    private readonly IBusinessContext _business;

    public FeedbackController(IFeedbackService svc, ICurrentUserService user, IBusinessContext business)
    {
        _svc = svc;
        _user = user;
        _business = business;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFeedbackRequest request)
    {
        try
        {
            var result = await _svc.CreateAsync(_business.CurrentBusinessId, _user.UserId, request);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        return Ok(await _svc.ListForBusinessAsync(_business.CurrentBusinessId));
    }
}
