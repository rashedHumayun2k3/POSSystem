using ResellerApi.DTOs.Partners;

namespace ResellerApi.Services.Interfaces;

public interface IPartnerService
{
    Task<List<PartnerDto>> ListAsync(string? partnerType, string? status);
    Task<PartnerDto> GetAsync(Guid id);
    Task<PartnerDto> CreateAsync(CreatePartnerRequest request, Guid userId);
    Task<PartnerDto> UpdateAsync(Guid id, UpdatePartnerRequest request, Guid userId);

    // R15.11 — new partner approval workflow.
    Task<PartnerApprovalStatusDto> GetApprovalStatusAsync(Guid partnerId);
    Task<PartnerApprovalStatusDto> CastVoteAsync(Guid partnerId, CastApprovalVoteRequest request, Guid userId);
    Task<PartnerDto> CancelPendingAsync(Guid partnerId, CancelPendingPartnerRequest request, Guid userId);
}
