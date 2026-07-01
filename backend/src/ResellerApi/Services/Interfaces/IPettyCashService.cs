using ResellerApi.DTOs.Expenses;

namespace ResellerApi.Services.Interfaces;

public interface IPettyCashService
{
    Task<List<PettyCashBoxDto>> ListBoxesAsync();
    Task<PettyCashBoxDto> GetBoxAsync(Guid id);
    Task<PettyCashBoxDto> GetOrCreateBoxForStaffAsync(Guid staffId, Guid userId);
    Task<PettyCashBoxDto> FundAsync(Guid boxId, FundPettyCashRequest req, Guid userId);
    Task<PettyCashBoxDto> AdjustAsync(Guid boxId, AdjustPettyCashRequest req, Guid userId);
    Task<List<PettyCashTxnDto>> ListTxnsAsync(Guid boxId, int limit);
}
