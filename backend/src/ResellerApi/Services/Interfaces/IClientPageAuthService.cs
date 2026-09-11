using ResellerApi.DTOs.ClientPage;

namespace ResellerApi.Services.Interfaces;

public interface IClientPageAuthService
{
    Task<ClientPageAuthResponse> GoogleLoginAsync(GoogleLoginRequest request);
    Task<ClientPageAuthResponse> FacebookLoginAsync(FacebookLoginRequest request);
}
