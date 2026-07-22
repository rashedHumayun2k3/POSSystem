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
    private readonly IValidator<GoogleVerifyEmailRequest> _verifyGoogleValidator;
    private readonly IValidator<RequestPasswordResetRequest> _requestPasswordResetValidator;
    private readonly IValidator<VerifyPasswordResetRequest> _verifyPasswordResetValidator;
    private readonly IValidator<CompletePasswordResetRequest> _completePasswordResetValidator;
    private readonly IValidator<FindMyEmailRequest> _findMyEmailValidator;

    public AuthController(
        IAuthService authService,
        IValidator<LoginRequest> loginValidator,
        IValidator<RequestSignupCodeRequest> requestCodeValidator,
        IValidator<VerifySignupCodeRequest> verifyCodeValidator,
        IValidator<SignUpRequest> signUpValidator,
        IValidator<GoogleVerifyEmailRequest> verifyGoogleValidator,
        IValidator<RequestPasswordResetRequest> requestPasswordResetValidator,
        IValidator<VerifyPasswordResetRequest> verifyPasswordResetValidator,
        IValidator<CompletePasswordResetRequest> completePasswordResetValidator,
        IValidator<FindMyEmailRequest> findMyEmailValidator)
    {
        _authService = authService;
        _loginValidator = loginValidator;
        _requestCodeValidator = requestCodeValidator;
        _verifyCodeValidator = verifyCodeValidator;
        _signUpValidator = signUpValidator;
        _verifyGoogleValidator = verifyGoogleValidator;
        _requestPasswordResetValidator = requestPasswordResetValidator;
        _verifyPasswordResetValidator = verifyPasswordResetValidator;
        _completePasswordResetValidator = completePasswordResetValidator;
        _findMyEmailValidator = findMyEmailValidator;
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

    [HttpPost("signup/verify-google")]
    [AllowAnonymous]
    [EnableRateLimiting("signup")]
    public async Task<IActionResult> VerifySignupEmailViaGoogle([FromBody] GoogleVerifyEmailRequest request)
    {
        var validation = await _verifyGoogleValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        try
        {
            var email = await _authService.VerifySignupEmailViaGoogleAsync(request);
            return Ok(new { verified = true, email });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { code = "EMAIL_TAKEN", message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { code = "GOOGLE_VERIFY_FAILED", message = ex.Message });
        }
    }

    [HttpPost("forgot-password/request-code")]
    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    public async Task<IActionResult> RequestPasswordResetCode([FromBody] RequestPasswordResetRequest request)
    {
        var validation = await _requestPasswordResetValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        try
        {
            await _authService.RequestPasswordResetCodeAsync(request);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { code = "EMAIL_NOT_FOUND", message = ex.Message });
        }
    }

    [HttpPost("forgot-password/verify-code")]
    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    public async Task<IActionResult> VerifyPasswordResetCode([FromBody] VerifyPasswordResetRequest request)
    {
        var validation = await _verifyPasswordResetValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        try
        {
            await _authService.VerifyPasswordResetCodeAsync(request);
            return Ok(new { verified = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { code = "VERIFICATION_FAILED", message = ex.Message });
        }
    }

    [HttpPost("forgot-password/complete")]
    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    public async Task<IActionResult> CompletePasswordReset([FromBody] CompletePasswordResetRequest request)
    {
        var validation = await _completePasswordResetValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        try
        {
            await _authService.CompletePasswordResetAsync(request);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { code = "RESET_FAILED", message = ex.Message });
        }
    }

    [HttpPost("forgot-password/find-email")]
    [AllowAnonymous]
    [EnableRateLimiting("find-email")]
    public async Task<IActionResult> FindMyEmail([FromBody] FindMyEmailRequest request)
    {
        var validation = await _findMyEmailValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(new { code = "VALIDATION_ERROR", details = validation.Errors.Select(e => e.ErrorMessage) });

        var result = await _authService.FindMyEmailAsync(request);
        return Ok(result);
    }
}
