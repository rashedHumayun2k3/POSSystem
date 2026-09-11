import { api } from './api';
import type {
  PartnerDto,
  CreatePartnerPayload,
  UpdatePartnerPayload,
  PartnerBalanceDto,
  CapitalInjectionDto,
  CreateCapitalInjectionPayload,
  CapitalLedgerEntryDto,
  CapitalInjectionApprovalStatusDto,
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

export const listPendingCapitalInjections = async (): Promise<CapitalInjectionDto[]> => {
  const { data } = await api.get('/partners/capital-injections/awaiting-approval');
  return data;
};

export const updateCapitalInjection = async (
  partnerId: string,
  injectionId: string,
  payload: CreateCapitalInjectionPayload
): Promise<CapitalInjectionDto> => {
  const { data } = await api.put(`/partners/${partnerId}/capital-injections/${injectionId}`, payload);
  return data;
};

export const deleteCapitalInjection = async (partnerId: string, injectionId: string): Promise<void> => {
  await api.delete(`/partners/${partnerId}/capital-injections/${injectionId}`);
};

export const submitCapitalInjection = async (partnerId: string, injectionId: string): Promise<CapitalInjectionDto> => {
  const { data } = await api.post(`/partners/${partnerId}/capital-injections/${injectionId}/submit`);
  return data;
};

export const getCapitalInjectionApproval = async (
  partnerId: string,
  injectionId: string
): Promise<CapitalInjectionApprovalStatusDto> => {
  const { data } = await api.get(`/partners/${partnerId}/capital-injections/${injectionId}/approval`);
  return data;
};

export const castCapitalInjectionVote = async (
  partnerId: string,
  injectionId: string,
  payload: { decision: 'APPROVE' | 'REJECT'; note?: string }
): Promise<CapitalInjectionApprovalStatusDto> => {
  const { data } = await api.post(`/partners/${partnerId}/capital-injections/${injectionId}/votes`, payload);
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
