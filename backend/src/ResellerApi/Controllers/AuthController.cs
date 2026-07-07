using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResellerApi.DTOs.Auth;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IValidator<LoginRequest> _loginValidator;
    private readonly IValidator<RequestSignupCodeRequest> _requestCodeValidator;
    private readonly IValidator<VerifySignupCodeRequest> _verifyCodeValidator;
    private readonly IValidator<SignUpRequest> _signUpValidator;

    public AuthController(
        IAuthService authService,
        IValidator<LoginRequest> loginValidator,
        IValidator<RequestSignupCodeRequest> requestCodeValidator,
        IValidator<VerifySignupCodeRequest> verifyCodeValidator,
        IValidator<SignUpRequest> signUpValidator)
    {
        _authService = authService;
        _loginValidator = loginValidator;
        _requestCodeValidator = requestCodeValidator;
        _verifyCodeValidator = verifyCodeValidator;
        _signUpValidator = signUpValidator;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var validation = await _loginValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        try
        {
            var result = await _authService.LoginAsync(request);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { code = "INVALID_CREDENTIALS", message = ex.Message });
        }
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
    {
        try
        {
            var result = await _authService.RefreshAsync(request.RefreshToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { code = "INVALID_TOKEN", message = ex.Message });
        }
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest request)
    {
        await _authService.RevokeAsync(request.RefreshToken);
        return NoContent();
    }

    [HttpPost("signup/request-code")]
    [AllowAnonymous]
    [EnableRateLimiting("signup")]
    public async Task<IActionResult> RequestSignupCode([FromBody] RequestSignupCodeRequest request)
    {
        var validation = await _requestCodeValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        try
        {
            await _authService.RequestSignupCodeAsync(request);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { code = "EMAIL_TAKEN", message = ex.Message });
        }
    }

    [HttpPost("signup/verify-code")]
    [AllowAnonymous]
    [EnableRateLimiting("signup")]
    public async Task<IActionResult> VerifySignupCode([FromBody] VerifySignupCodeRequest request)
    {
        var validation = await _verifyCodeValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        try
        {
            await _authService.VerifySignupCodeAsync(request);
            return Ok(new { verified = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { code = "VERIFICATION_FAILED", message = ex.Message });
        }
    }

    [HttpPost("signup/complete")]
    [AllowAnonymous]
    [EnableRateLimiting("signup")]
    public async Task<IActionResult> CompleteSignup([FromBody] SignUpRequest request)
    {
        var validation = await _signUpValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        try
        {
            var result = await _authService.CompleteSignupAsync(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { code = "SIGNUP_FAILED", message = ex.Message });
        }
    }
}
