using ResellerApi.DTOs.Partners;

namespace ResellerApi.Services.Interfaces;

public interface IPartnerService
{
    Task<List<PartnerDto>> ListAsync(string? partnerType, string? status);
    Task<PartnerDto> GetAsync(Guid id);
    Task<PartnerDto> CreateAsync(CreatePartnerRequest request, Guid userId);
    Task<PartnerDto> UpdateAsync(Guid id, UpdatePartnerRequest request, Guid userId);
}
