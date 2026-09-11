using ResellerApi.DTOs.Remittances;

namespace ResellerApi.Services.Interfaces;

public interface IRemittanceService
{
    Task<List<CourierCodSummaryDto>> GetSummaryAsync();
    Task<List<OrderInCourierBoardDto>> GetCourierOrdersAsync(Guid courierId, string? status);
    Task<CourierRemittanceDto> CreateAsync(CreateRemittanceRequest request, Guid userId);
    Task<List<CourierRemittanceDto>> ListAsync();
}
