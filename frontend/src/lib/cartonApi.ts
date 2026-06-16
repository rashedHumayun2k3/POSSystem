import { api } from './api';
import type {
  CartonSummary, CartonDetail, StoreroomSummary,
  LocationLookupItem, DamagedItem, TripWithCartons,
} from '@/types/carton';

// ── List & detail ─────────────────────────────────────────────────────────────

export const getCartons = (params: { tripId?: string; status?: string; variantId?: string } = {}) =>
  api.get<CartonSummary[]>('/cartons', { params }).then(r => r.data);

export const getCarton = (id: string) =>
  api.get<CartonDetail>(`/cartons/${id}`).then(r => r.data);

// ── Create ────────────────────────────────────────────────────────────────────

export const bulkCreateCartons = (body: {
  tripId: string;
  count: number;
  locationPrefix?: string;
  customNos?: string[];
}) => api.post<CartonSummary[]>('/cartons/bulk', body).then(r => r.data);

// ── Update ────────────────────────────────────────────────────────────────────

export const updateCarton = (id: string, body: {
  cartonNo?: string;
  location?: string;
  notes?: string;
}) => api.patch<CartonDetail>(`/cartons/${id}`, body).then(r => r.data);

// ── Open carton ───────────────────────────────────────────────────────────────

export const openCarton = (id: string, body: {
  location?: string;
  notes?: string;
  items: { variantId: string; qtyInCarton: number; qtyDamaged: number; labelPrice: number }[];
}) => api.post<CartonDetail>(`/cartons/${id}/open`, body).then(r => r.data);

// ── Label item ────────────────────────────────────────────────────────────────

export const labelCartonItem = (cartonId: string, itemId: string, qtyNowLabeled: number) =>
  api.post<CartonDetail>(`/cartons/${cartonId}/items/${itemId}/label`, { qtyNowLabeled }).then(r => r.data);

// ── Delete ────────────────────────────────────────────────────────────────────

export const deleteCarton = (id: string) =>
  api.delete(`/cartons/${id}`);

// ── Reports ───────────────────────────────────────────────────────────────────

export const getStoreroomSummary = () =>
  api.get<StoreroomSummary>('/cartons/summary').then(r => r.data);

export const locationLookup = (variantId: string) =>
  api.get<LocationLookupItem[]>('/cartons/location', { params: { variantId } }).then(r => r.data);

export const getDamagedItems = () =>
  api.get<DamagedItem[]>('/cartons/damaged').then(r => r.data);

export const getTripsWithCartons = () =>
  api.get<TripWithCartons[]>('/cartons/trips').then(r => r.data);
