using ResellerApi.DTOs.Expenses;

namespace ResellerApi.Services.Interfaces;

public interface IExpenseService
{
    Task<PagedResult<ExpenseDto>> ListAsync(ExpenseListRequest req);
    Task<ExpenseDto> GetAsync(Guid id);
    Task<ExpenseDto> CreateAsync(CreateExpenseRequest req, Guid userId, bool isOwner);
    Task<ExpenseDto> UpdateAsync(Guid id, UpdateExpenseRequest req, Guid userId);
    Task DeleteAsync(Guid id, Guid userId);
    Task<ExpenseDto> ApproveAsync(Guid id, Guid userId, string? note);
    Task<ExpenseDto> RejectAsync(Guid id, Guid userId, string reason);
}
