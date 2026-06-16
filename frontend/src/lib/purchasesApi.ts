import { api } from './api';
import type {
  PurchaseTripSummary,
  PurchaseTripDetail,
  PurchaseItemDto,
  PurchaseTripCostDto,
  PurchaseReceiveSessionDto,
  AddItemPayload,
  UpdateItemPayload,
  AddCostPayload,
  CreateReceiveSessionPayload,
  SessionPreview,
  ForceCloseRequired,
  SourceType,
} from '@/types/purchases';

const BASE = '/purchase-trips';

export const listTrips = async (status?: string): Promise<PurchaseTripSummary[]> => {
  const { data } = await api.get(BASE, { params: status ? { status } : {} });
  return data;
};

export const getTrip = async (id: string): Promise<PurchaseTripDetail> => {
  const { data } = await api.get(`${BASE}/${id}`);
  return data;
};

export const createTrip = async (payload: { sourceType: SourceType; note?: string }): Promise<PurchaseTripDetail> => {
  const { data } = await api.post(BASE, payload);
  return data;
};

export const updateTripHeader = async (
  tripId: string,
  payload: { expectedDeliveryDate?: string | null; supplierPoRef?: string | null },
): Promise<PurchaseTripDetail> => {
  const { data } = await api.patch(`${BASE}/${tripId}/header`, payload);
  return data;
};

// ── Items ──────────────────────────────────────────────────────────────────────

export const addItem = async (tripId: string, payload: AddItemPayload): Promise<PurchaseItemDto> => {
  const { data } = await api.post(`${BASE}/${tripId}/items`, payload);
  return data;
};

export const updateItem = async (tripId: string, itemId: string, payload: UpdateItemPayload): Promise<PurchaseItemDto> => {
  const { data } = await api.put(`${BASE}/${tripId}/items/${itemId}`, payload);
  return data;
};

export const removeItem = async (tripId: string, itemId: string): Promise<void> => {
  await api.delete(`${BASE}/${tripId}/items/${itemId}`);
};

// ── Costs ──────────────────────────────────────────────────────────────────────

export const addCost = async (tripId: string, payload: AddCostPayload): Promise<PurchaseTripCostDto> => {
  const { data } = await api.post(`${BASE}/${tripId}/costs`, payload);
  return data;
};

export const removeCost = async (tripId: string, costId: string): Promise<void> => {
  await api.delete(`${BASE}/${tripId}/costs/${costId}`);
};

// ── Trip lifecycle ─────────────────────────────────────────────────────────────

export const submitTrip = async (tripId: string): Promise<PurchaseTripDetail> => {
  const { data } = await api.post(`${BASE}/${tripId}/submit`);
  return data;
};

export const approveTrip = async (tripId: string): Promise<PurchaseTripDetail> => {
  const { data } = await api.post(`${BASE}/${tripId}/approve`);
  return data;
};

export const cancelTrip = async (tripId: string): Promise<PurchaseTripDetail> => {
  const { data } = await api.post(`${BASE}/${tripId}/cancel`);
  return data;
};

// ── Receive sessions ───────────────────────────────────────────────────────────

export const createReceiveSession = async (
  tripId: string,
  payload: CreateReceiveSessionPayload,
): Promise<PurchaseTripDetail> => {
  const { data } = await api.post(`${BASE}/${tripId}/sessions`, payload);
  return data;
};

export const previewSession = async (tripId: string, sessionId: string): Promise<SessionPreview> => {
  const { data } = await api.get(`${BASE}/${tripId}/sessions/${sessionId}/preview`);
  return data;
};

export const approveSession = async (tripId: string, sessionId: string): Promise<PurchaseTripDetail> => {
  const { data } = await api.post(`${BASE}/${tripId}/sessions/${sessionId}/approve`);
  return data;
};

export const rejectSession = async (tripId: string, sessionId: string, reason?: string): Promise<PurchaseTripDetail> => {
  const { data } = await api.post(`${BASE}/${tripId}/sessions/${sessionId}/reject`, { reason });
  return data;
};

// ── Close trip ─────────────────────────────────────────────────────────────────

export const closeTrip = async (
  tripId: string,
  forceCloseReason?: string,
): Promise<PurchaseTripDetail | ForceCloseRequired> => {
  try {
    const { data } = await api.post(`${BASE}/${tripId}/close`, {
      forceClose: !!forceCloseReason,
      forceCloseReason,
    });
    return data as PurchaseTripDetail;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: ForceCloseRequired } };
    if (axiosErr.response?.status === 422 && axiosErr.response.data?.requiresForceClose) {
      return axiosErr.response.data;
    }
    throw err;
  }
};
