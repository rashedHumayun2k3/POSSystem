using ResellerApi.DTOs.Partners;

namespace ResellerApi.Services.Interfaces;

public interface IPartnerCapitalService
{
    Task<CapitalInjectionDto> RecordInjectionAsync(Guid partnerId, CreateCapitalInjectionRequest request, Guid userId);
    Task<List<CapitalInjectionDto>> ListInjectionsAsync(Guid partnerId);
    Task<List<CapitalLedgerEntryDto>> ListLedgerAsync(Guid partnerId, DateTime? from, DateTime? to);

    /// <summary>
    /// Always computed live by summing capital_ledger — never stored as a column (R15.4/R5).
    /// </summary>
    Task<PartnerBalanceDto> GetBalanceAsync(Guid partnerId);
}
