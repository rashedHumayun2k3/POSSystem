import { api } from './api';
import type {
  PartnerDto,
  CreatePartnerPayload,
  UpdatePartnerPayload,
  PartnerBalanceDto,
  CapitalInjectionDto,
  CreateCapitalInjectionPayload,
  CapitalLedgerEntryDto,
  PartnerApprovalStatusDto,
  CastApprovalVotePayload,
  CancelPendingPartnerPayload,
} from '@/types/partner';

export const listPartners = async (params?: { partnerType?: string; status?: string }): Promise<PartnerDto[]> => {
  const { data } = await api.get('/partners', { params });
  return data;
};

export const getPartner = async (id: string): Promise<PartnerDto> => {
  const { data } = await api.get(`/partners/${id}`);
  return data;
};

export const createPartner = async (payload: CreatePartnerPayload): Promise<PartnerDto> => {
  const { data } = await api.post('/partners', payload);
  return data;
};

export const updatePartner = async (id: string, payload: UpdatePartnerPayload): Promise<PartnerDto> => {
  const { data } = await api.put(`/partners/${id}`, payload);
  return data;
};

export const getPartnerBalance = async (id: string): Promise<PartnerBalanceDto> => {
  const { data } = await api.get(`/partners/${id}/balance`);
  return data;
};

export const listCapitalInjections = async (partnerId: string): Promise<CapitalInjectionDto[]> => {
  const { data } = await api.get(`/partners/${partnerId}/capital-injections`);
  return data;
};

export const recordCapitalInjection = async (
  partnerId: string,
  payload: CreateCapitalInjectionPayload
): Promise<CapitalInjectionDto> => {
  const { data } = await api.post(`/partners/${partnerId}/capital-injections`, payload);
  return data;
};

export const listPartnerLedger = async (
  partnerId: string,
  params?: { from?: string; to?: string }
): Promise<CapitalLedgerEntryDto[]> => {
  const { data } = await api.get(`/partners/${partnerId}/ledger`, { params });
  return data;
};

// R15.11 — new partner approval workflow.

export const getPartnerApproval = async (partnerId: string): Promise<PartnerApprovalStatusDto> => {
  const { data } = await api.get(`/partners/${partnerId}/approval`);
  return data;
};

export const castApprovalVote = async (
  partnerId: string,
  payload: CastApprovalVotePayload
): Promise<PartnerApprovalStatusDto> => {
  const { data } = await api.post(`/partners/${partnerId}/votes`, payload);
  return data;
};

export const cancelPendingPartner = async (
  partnerId: string,
  payload: CancelPendingPartnerPayload
): Promise<PartnerDto> => {
  const { data } = await api.post(`/partners/${partnerId}/cancel`, payload);
  return data;
};
