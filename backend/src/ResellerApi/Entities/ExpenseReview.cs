using ResellerApi.Entities.Base;
namespace ResellerApi.Entities;

public class ExpenseReview : BusinessScopedEntity
{
    public Guid ExpenseId { get; set; }
    public Expense Expense { get; set; } = null!;
    public Guid PartnerId { get; set; }
    public Partner Partner { get; set; } = null!;
    public int ReviewedVersion { get; set; }
    public DateTime ReviewedAt { get; set; }
}
