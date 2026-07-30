using ResellerApi.DTOs.Orders;

namespace ResellerApi.Services.Interfaces;

public interface ICustomerService
{
    Task<List<CustomerSummaryDto>> ListAsync(string? q);
    Task<List<CustomerCacheDto>> ListForCacheAsync();
    Task<CustomerSummaryDto> GetAsync(Guid id);
    Task<CustomerSummaryDto?> FindByPhoneAsync(string phone);
    Task<CustomerSummaryDto> UpdateAsync(Guid id, UpdateCustomerRequest request, Guid userId);
}
