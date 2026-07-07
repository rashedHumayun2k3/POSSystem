using ResellerApi.DTOs.Orders;

namespace ResellerApi.Services.Interfaces;

public interface IOrderService
{
    Task<OrderDetailDto> CreateAsync(CreateOrderRequest request, Guid userId);
    Task<List<OrderListDto>> ListAsync(string? orderStatus, string? fulfillmentStatus, string? channel, string? q, DateTime? from, DateTime? to, bool canSeeCosts);
    Task<List<OrderListDto>> ListByProductAsync(Guid productId, bool canSeeCosts);
    Task<OrderDetailDto> GetAsync(Guid id, bool isOwner);
    Task<OrderDetailDto> UpdateAsync(Guid id, UpdateOrderRequest request, Guid userId);
    Task DeleteAsync(Guid id, string reason, Guid userId);
    Task<OrderDetailDto> ConfirmAsync(Guid id, Guid userId);
    Task<OrderDetailDto> PackAsync(Guid id, Guid userId);
    Task<OrderDetailDto> HandoverAsync(Guid id, HandoverOrderRequest request, Guid userId);
    Task<OrderDetailDto> DeliverAsync(Guid id, Guid userId);
    Task<OrderDetailDto> ReturnAsync(Guid id, ReturnOrderRequest request, Guid userId);
    Task<OrderDetailDto> CancelAsync(Guid id, CancelOrderRequest request, Guid userId);
    Task<OrderDetailDto> AddPaymentAsync(Guid id, AddOrderPaymentRequest request, Guid userId);
    Task<byte[]> GetChallanPdfAsync(Guid id);
    Task<byte[]> GetReceiptPdfAsync(Guid id);
    Task ClaimAsync(Guid id, Guid userId);
}
