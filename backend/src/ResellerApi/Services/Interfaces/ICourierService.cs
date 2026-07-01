using ResellerApi.DTOs.Orders;

namespace ResellerApi.Services.Interfaces;

public interface ICourierService
{
    Task<List<CourierDto>> ListCouriersAsync(bool activeOnly = true);
    Task<CourierDto> CreateCourierAsync(CreateCourierRequest request, Guid userId);
    Task<CourierDto> UpdateCourierAsync(Guid id, UpdateCourierRequest request, Guid userId);

    Task<List<DeliveryManDto>> ListDeliveryMenAsync(bool activeOnly = true);
    Task<DeliveryManDto> CreateDeliveryManAsync(CreateDeliveryManRequest request, Guid userId);
    Task<DeliveryManDto> UpdateDeliveryManAsync(Guid id, UpdateDeliveryManRequest request, Guid userId);
}
