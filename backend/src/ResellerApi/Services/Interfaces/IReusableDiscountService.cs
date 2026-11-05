using ResellerApi.DTOs.Catalog;

namespace ResellerApi.Services.Interfaces;

public interface IReusableDiscountService
{
    Task<List<ReusableDiscountDto>> ListAsync(bool includeArchived = false);
    Task<List<AppliedDiscountVariantDto>> ListAppliedVariantsAsync(Guid id);
    Task<List<ActiveDiscountAssignmentDto>> ListActiveAssignmentsAsync();
    Task RemoveVariantAsync(Guid id, Guid variantId, Guid userId);
    Task<ReusableDiscountDto> CreateAsync(CreateReusableDiscountRequest request, Guid userId);
    Task<ReusableDiscountDto> UpdateAsync(Guid id, UpdateReusableDiscountRequest request);
    Task DeleteAsync(Guid id);
    Task<ApplyReusableDiscountResult> ApplyAsync(Guid id, ApplyReusableDiscountRequest request, Guid userId);
    Task ArchiveAsync(Guid id, bool archived);
}
