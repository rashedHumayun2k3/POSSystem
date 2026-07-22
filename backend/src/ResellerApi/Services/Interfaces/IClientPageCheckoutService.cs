using ResellerApi.DTOs.ClientPage;

namespace ResellerApi.Services.Interfaces;

public interface IClientPageCheckoutService
{
    Task<ClientPageCheckoutResultDto> CreateGuestOrderAsync(ClientPageCheckoutRequest request);
    Task<ClientPageShippingAddressDto?> GetSavedAddressAsync(string phone);
    Task<List<ClientPageDeliveryEstimateItemDto>> GetDeliveryEstimatesAsync(ClientPageDeliveryEstimateRequest request);
}
