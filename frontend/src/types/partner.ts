// Module 15 — Partnership & Capital Ledger (sub-phase 15a).
// All amount fields are paisa (integer, ÷100 for display) per R15.2.

export type PartnerType = "MANAGING" | "SLEEPING";
export type PartnerStatus = "ACTIVE" | "EXITED";

export interface PartnerDto {
  id: string;
  name: string;
  phone: string | null;
  partnerType: PartnerType;
  status: PartnerStatus;
  deferredLossPaisa: number;
  joinDate: string | null;
  note: string | null;
  capitalBalancePaisa: number;
  profitBalancePaisa: number;
}

export interface CreatePartnerPayload {
  name: string;
  phone?: string;
  partnerType: PartnerType;
  joinDate?: string;
  note?: string;
}

export interface UpdatePartnerPayload {
  name: string;
  phone?: string;
  partnerType: PartnerType;
  joinDate?: string;
  note?: string;
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
  note: string | null;
}

export interface CreateCapitalInjectionPayload {
  amountPaisa: number;
  injectedAt?: string;
  lockInMonths: number;
  note?: string;
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
