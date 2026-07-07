using ResellerApi.DTOs.Auth;

namespace ResellerApi.Services.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> RefreshAsync(string refreshToken);
    Task RevokeAsync(string refreshToken);
    Task RequestSignupCodeAsync(RequestSignupCodeRequest request);
    Task VerifySignupCodeAsync(VerifySignupCodeRequest request);
    Task<AuthResponse> CompleteSignupAsync(SignUpRequest request);
}
