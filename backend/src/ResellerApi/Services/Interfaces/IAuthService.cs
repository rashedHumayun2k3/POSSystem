using ResellerApi.DTOs.Auth;

namespace ResellerApi.Services.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> RefreshAsync(string refreshToken);
    Task RevokeAsync(string refreshToken);
    Task RequestSignupCodeAsync(RequestSignupCodeRequest request, string? lang = null);
    Task VerifySignupCodeAsync(VerifySignupCodeRequest request);
    Task<string> VerifySignupEmailViaGoogleAsync(GoogleVerifyEmailRequest request);
    Task<AuthResponse> CompleteSignupAsync(SignUpRequest request);
    Task RequestPasswordResetCodeAsync(RequestPasswordResetRequest request, string? lang = null);
    Task VerifyPasswordResetCodeAsync(VerifyPasswordResetRequest request);
    Task CompletePasswordResetAsync(CompletePasswordResetRequest request);
    Task<FindMyEmailResponse> FindMyEmailAsync(FindMyEmailRequest request);
}
