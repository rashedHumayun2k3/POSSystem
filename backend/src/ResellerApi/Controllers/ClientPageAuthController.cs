using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/clientpage/auth")]
[AllowAnonymous]
public class ClientPageAuthController : ControllerBase
{
    private readonly IClientPageAuthService _auth;

    public ClientPageAuthController(IClientPageAuthService auth)
    {
        _auth = auth;
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        try
        {
            return Ok(await _auth.GoogleLoginAsync(request));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("facebook")]
    public async Task<IActionResult> FacebookLogin([FromBody] FacebookLoginRequest request)
    {
        try
        {
            return Ok(await _auth.FacebookLoginAsync(request));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }
}
