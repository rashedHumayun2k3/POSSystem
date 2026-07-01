namespace ResellerApi.DTOs.Partners;

// All amount fields are in paisa (integer, ÷100 for display) per R15.2.

public record PartnerDto(
    Guid Id,
    string Name,
    string? Phone,
    string PartnerType,
    string Status,
    long DeferredLossPaisa,
    DateTime? JoinDate,
    string? Note,
    long CapitalBalancePaisa,
    long ProfitBalancePaisa,
    string? NidNumber,
    string? Address,
    string? Email,
    string? BankAccountNumber,
    string? BankName,
    decimal? AgreedProfitSharePct,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelation
);

public record CreatePartnerRequest(
    string Name,
    string? Phone,
    string PartnerType,
    DateTime? JoinDate,
    string? Note,
    string NidNumber,
    string Address,
    string? Email,
    string? BankAccountNumber,
    string? BankName,
    decimal? AgreedProfitSharePct,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelation
);

public record UpdatePartnerRequest(
    string Name,
    string? Phone,
    string PartnerType,
    DateTime? JoinDate,
    string? Note,
    string NidNumber,
    string Address,
    string? Email,
    string? BankAccountNumber,
    string? BankName,
    decimal? AgreedProfitSharePct,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelation
);

// R15.11 — new partner approval workflow.

public record PartnerApprovalVoteDto(
    Guid Id,
    Guid PartnerId,
    Guid VotedByPartnerId,
    string VotedByPartnerName,
    string Decision,
    string? Note,
    DateTime VotedAt
);

public record CastApprovalVoteRequest(
    Guid VotedByPartnerId,
    string Decision, // APPROVE | REJECT
    string? Note
);

public record CancelPendingPartnerRequest(string Reason);

public record PartnerApprovalStatusDto(
    Guid PartnerId,
    string Status,
    int ApproveCount,
    int RejectCount,
    int RequiredVotes,
    int ActiveManagingPartnerCount,
    List<PartnerApprovalVoteDto> Votes
);

public record PartnerBalanceDto(
    long CapitalBalancePaisa,
    long ProfitBalancePaisa,
    long DeferredLossPaisa
);

public record CapitalInjectionDto(
    Guid Id,
    Guid PartnerId,
    long AmountPaisa,
    DateTime InjectedAt,
    int LockInMonths,
    DateTime LockInExpiresAt,
    string? Note
);

public record CreateCapitalInjectionRequest(
    long AmountPaisa,
    DateTime? InjectedAt,
    int LockInMonths,
    string? Note
);

public record CapitalLedgerEntryDto(
    Guid Id,
    Guid PartnerId,
    string EntryType,
    string Bucket,
    long AmountPaisa,
    long BalanceAfterPaisa,
    string? ReferenceType,
    Guid? ReferenceId,
    string? Note,
    DateTime CreatedAt
);
