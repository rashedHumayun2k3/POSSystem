namespace ResellerApi.DTOs.Partners;

// All amount fields are in paisa (integer, ÷100 for display) per R15.2.

public record PartnerDto(
    Guid Id,
    string Name,
    string? Phone,
    string? PhotoUrl,
    Guid? LinkedUserId,
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
    string? PhotoUrl,
    Guid? LinkedUserId,
    string? LoginPhone,
    string? LoginEmail,
    string? TemporaryPassword,
    bool CanAccessPos,
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
    string? PhotoUrl,
    Guid? LinkedUserId,
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
    string PaymentMethod,
    string PaidTo,
    string? BankName,
    string? BankAccountNumber,
    string? ChequeNumber,
    string? PaymentReference,
    string? ProofImageUrl,
    string? Note,
    string Status,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    DateTime? RejectedAt,
    string? RejectionReason
);

public record CreateCapitalInjectionRequest(
    long AmountPaisa,
    DateTime? InjectedAt,
    int LockInMonths,
    string? PaymentMethod,
    string? PaidTo,
    string? BankName,
    string? BankAccountNumber,
    string? ChequeNumber,
    string? PaymentReference,
    string? ProofImageUrl,
    string? Note
);

public record CapitalInjectionApprovalVoteDto(
    Guid Id,
    Guid CapitalInjectionId,
    Guid VotedByPartnerId,
    string VotedByPartnerName,
    string Decision,
    string? Note,
    DateTime VotedAt
);

public record CastCapitalInjectionApprovalVoteRequest(
    string Decision,
    string? Note
);

public record CapitalInjectionApprovalStatusDto(
    Guid CapitalInjectionId,
    string Status,
    int ApproveCount,
    int RejectCount,
    int RequiredVotes,
    int ActiveManagingPartnerCount,
    List<CapitalInjectionApprovalVoteDto> Votes
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
