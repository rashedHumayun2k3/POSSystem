using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class PettyCashBox : BusinessScopedEntity
{
    public Guid StaffId { get; set; }
    public User Staff { get; set; } = null!;

    public decimal Balance { get; set; }    // running balance maintained transactionally

    public ICollection<PettyCashTxn> Transactions { get; set; } = new List<PettyCashTxn>();
}
