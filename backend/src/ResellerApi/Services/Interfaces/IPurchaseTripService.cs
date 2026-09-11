using ResellerApi.DTOs.Purchases;

namespace ResellerApi.Services.Interfaces;

public interface IPurchaseTripService
{
    // ── CRUD ──────────────────────────────────────────────────────────────────
    Task<PurchaseTripDetailDto> CreateAsync(CreatePurchaseTripRequest request, Guid userId);
    Task<List<PurchaseTripSummaryDto>> ListAsync(string? status);
    Task<PurchaseTripDetailDto> GetAsync(Guid id);
    Task<PurchaseTripDetailDto> UpdateHeaderAsync(Guid tripId, UpdateTripHeaderRequest request, Guid userId);
    Task<PurchaseTripDetailDto> UpdateAttachmentsAsync(Guid tripId, UpdateTripAttachmentsRequest request, Guid userId);

    // ── Items ─────────────────────────────────────────────────────────────────
    Task<PurchaseItemDto> AddItemAsync(Guid tripId, AddPurchaseItemRequest request, Guid userId);
    Task<PurchaseItemDto> UpdateItemAsync(Guid tripId, Guid itemId, UpdatePurchaseItemRequest request, Guid userId);
    Task RemoveItemAsync(Guid tripId, Guid itemId, Guid userId);

    // ── Costs ─────────────────────────────────────────────────────────────────
    Task<PurchaseTripCostDto> AddCostAsync(Guid tripId, AddPurchaseTripCostRequest request, Guid userId);
    Task RemoveCostAsync(Guid tripId, Guid costId, Guid userId);

    // ── Trip lifecycle ────────────────────────────────────────────────────────
    Task<PurchaseTripDetailDto> SubmitForApprovalAsync(Guid tripId, Guid userId);
    Task<PurchaseTripDetailDto> ApproveAsync(Guid tripId, Guid userId);
    Task<PurchaseTripDetailDto> CancelAsync(Guid tripId, Guid userId);

    // ── Receive sessions ──────────────────────────────────────────────────────
    Task<PurchaseTripDetailDto> CreateReceiveSessionAsync(Guid tripId, CreateReceiveSessionRequest request, Guid userId, bool isOwner);
    Task<CompleteTripPreviewDto> PreviewSessionAsync(Guid tripId, Guid sessionId);
    Task<PurchaseTripDetailDto> ApproveSessionAsync(Guid tripId, Guid sessionId, Guid userId);
    Task<PurchaseTripDetailDto> RejectSessionAsync(Guid tripId, Guid sessionId, string? reason, Guid userId);

    // ── Close trip ────────────────────────────────────────────────────────────
    Task<PurchaseTripDetailDto> CloseTripAsync(Guid tripId, string? forceCloseReason, Guid userId);
}
