using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PettyCashTxn : BusinessScopedEntity
{
    public Guid BoxId { get; set; }
    public PettyCashBox Box { get; set; } = null!;

    public string TxnType { get; set; } = null!;    // FUND_IN | SPEND | ADJUST
    public decimal Amount { get; set; }              // always positive; sign implied by TxnType

    public Guid? ExpenseId { get; set; }             // linked expense when TxnType = SPEND
    public Expense? Expense { get; set; }

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string? Note { get; set; }
}
