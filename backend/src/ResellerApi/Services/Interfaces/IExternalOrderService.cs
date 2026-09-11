using ResellerApi.DTOs.ExternalOrders;

namespace ResellerApi.Services.Interfaces;

public interface IExternalOrderService
{
    Task<ExternalOrderCreateResponse> CreateAsync(string apiKey, ExternalOrderCreateRequest request);
}
