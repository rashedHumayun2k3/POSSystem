// Module 15 — Partnership & Capital Ledger (sub-phase 15a).
// All amount fields are paisa (integer, ÷100 for display) per R15.2.

export type PartnerType = "MANAGING" | "SLEEPING";
export type PartnerStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "EXITED";

export interface PartnerDto {
  id: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  linkedUserId: string | null;
  partnerType: PartnerType;
  status: PartnerStatus;
  deferredLossPaisa: number;
  joinDate: string | null;
  note: string | null;
  capitalBalancePaisa: number;
  profitBalancePaisa: number;
  nidNumber: string | null;
  address: string | null;
  email: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  agreedProfitSharePct: number | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
}

interface PartnerProfileFields {
  photoUrl?: string;
  linkedUserId?: string;
  loginPhone?: string;
  loginEmail?: string;
  temporaryPassword?: string;
  canAccessPos?: boolean;
  nidNumber: string;
  address: string;
  email?: string;
  bankAccountNumber?: string;
  bankName?: string;
  agreedProfitSharePct?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}

export interface CreatePartnerPayload extends PartnerProfileFields {
  name: string;
  phone?: string;
  partnerType: PartnerType;
  joinDate?: string;
  note?: string;
}

export interface UpdatePartnerPayload extends PartnerProfileFields {
  name: string;
  phone?: string;
  partnerType: PartnerType;
  joinDate?: string;
  note?: string;
}

// R15.11 — new partner approval workflow.

export type ApprovalDecision = "APPROVE" | "REJECT";

export interface PartnerApprovalVoteDto {
  id: string;
  partnerId: string;
  votedByPartnerId: string;
  votedByPartnerName: string;
  decision: ApprovalDecision;
  note: string | null;
  votedAt: string;
}

export interface PartnerApprovalStatusDto {
  partnerId: string;
  status: PartnerStatus;
  approveCount: number;
  rejectCount: number;
  requiredVotes: number;
  activeManagingPartnerCount: number;
  votes: PartnerApprovalVoteDto[];
}

export interface CastApprovalVotePayload {
  decision: ApprovalDecision;
  note?: string;
}

export interface CancelPendingPartnerPayload {
  reason: string;
}

export interface PartnerBalanceDto {
  capitalBalancePaisa: number;
  profitBalancePaisa: number;
  deferredLossPaisa: number;
}

export interface CapitalInjectionDto {
  id: string;
  partnerId: string;
  amountPaisa: number;
  injectedAt: string;
  lockInMonths: number;
  lockInExpiresAt: string;
  paymentMethod: PaymentMethod;
  paidTo: string;
  bankName: string | null;
  bankAccountNumber: string | null;
  chequeNumber: string | null;
  paymentReference: string | null;
  proofImageUrl: string | null;
  note: string | null;
  status: CapitalInjectionStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
}

export type PaymentMethod = "CASH" | "BANK" | "CHEQUE" | "MOBILE_BANKING";
export type CapitalInjectionStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface CreateCapitalInjectionPayload {
  amountPaisa: number;
  injectedAt?: string;
  lockInMonths: number;
  paymentMethod: PaymentMethod;
  paidTo: string;
  bankName?: string;
  bankAccountNumber?: string;
  chequeNumber?: string;
  paymentReference?: string;
  proofImageUrl?: string;
  note?: string;
}

export interface CapitalInjectionApprovalVoteDto {
  id: string;
  capitalInjectionId: string;
  votedByPartnerId: string;
  votedByPartnerName: string;
  decision: ApprovalDecision;
  note: string | null;
  votedAt: string;
}

export interface CapitalInjectionApprovalStatusDto {
  capitalInjectionId: string;
  status: CapitalInjectionStatus;
  approveCount: number;
  rejectCount: number;
  requiredVotes: number;
  activeManagingPartnerCount: number;
  votes: CapitalInjectionApprovalVoteDto[];
}

export type LedgerEntryType =
  | "CAPITAL_INJECTION"
  | "PROFIT_CREDIT"
  | "LOSS_DEBIT"
  | "LOSS_RECOVERY"
  | "DISTRIBUTION"
  | "WITHDRAWAL"
  | "CORRECTION"
  | "EXIT_SETTLEMENT";

export type LedgerBucket = "CAPITAL" | "PROFIT";

export interface CapitalLedgerEntryDto {
  id: string;
  partnerId: string;
  entryType: LedgerEntryType;
  bucket: LedgerBucket;
  amountPaisa: number;
  balanceAfterPaisa: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}
