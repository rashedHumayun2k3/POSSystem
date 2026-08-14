using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class CapitalInjectionApprovalVote : BusinessScopedEntity
{
    public Guid CapitalInjectionId { get; set; }
    public Guid VotedByPartnerId { get; set; }
    public string Decision { get; set; } = null!;
    public string? Note { get; set; }
    public DateTime VotedAt { get; set; }

    public CapitalInjection CapitalInjection { get; set; } = null!;
    public Partner VotedByPartner { get; set; } = null!;
}
