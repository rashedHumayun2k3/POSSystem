using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

/// <summary>
/// One managing partner's vote on whether a newly-added partner should be approved (R15.11).
/// Insert-only, like CapitalLedgerEntry — votes are never edited, only cast once per
/// (PartnerId, VotedByPartnerId) pair (unique index).
/// </summary>
public class PartnerApprovalVote : BusinessScopedEntity
{
    public Guid PartnerId { get; set; }          // the pending partner being voted on
    public Guid VotedByPartnerId { get; set; }    // the ACTIVE managing partner casting the vote
    public string Decision { get; set; } = null!; // APPROVE | REJECT
    public string? Note { get; set; }              // mandatory when Decision == REJECT
    public DateTime VotedAt { get; set; }

    public Partner Partner { get; set; } = null!;
    public Partner VotedByPartner { get; set; } = null!;
}
