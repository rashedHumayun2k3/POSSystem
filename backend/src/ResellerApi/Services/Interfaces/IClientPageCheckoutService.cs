using ResellerApi.DTOs.ClientPage;

namespace ResellerApi.Services.Interfaces;

public interface IClientPageCheckoutService
{
    Task<ClientPageCheckoutResultDto> CreateGuestOrderAsync(ClientPageCheckoutRequest request);
}
