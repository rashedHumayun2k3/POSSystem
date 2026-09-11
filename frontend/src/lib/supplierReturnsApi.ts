import { api } from './api';
import type {
  SupplierReturnListItem,
  SupplierReturnDetail,
  SupplierReturnItemPayload,
  DamagedStockItem,
} from '@/types/supplierReturns';

const BASE = '/supplier-returns';

export const listSupplierReturns = async (status?: string): Promise<SupplierReturnListItem[]> => {
  const { data } = await api.get(BASE, { params: status ? { status } : {} });
  return data;
};

export const listDamagedStock = async (branchId?: string, search?: string): Promise<DamagedStockItem[]> => {
  const { data } = await api.get(`${BASE}/damaged-stock`, { params: { branchId, search } });
  return data;
};

export const getSupplierReturn = async (id: string): Promise<SupplierReturnDetail> => {
  const { data } = await api.get(`${BASE}/${id}`);
  return data;
};

export const createSupplierReturn = async (payload: {
  supplierId: string;
  tripId?: string;
  note?: string;
}): Promise<SupplierReturnDetail> => {
  const { data } = await api.post(BASE, payload);
  return data;
};

export const addSupplierReturnItem = async (
  returnId: string,
  payload: SupplierReturnItemPayload,
): Promise<SupplierReturnDetail> => {
  const { data } = await api.post(`${BASE}/${returnId}/items`, payload);
  return data;
};

export const updateSupplierReturnItem = async (
  returnId: string,
  itemId: string,
  payload: SupplierReturnItemPayload,
): Promise<SupplierReturnDetail> => {
  const { data } = await api.put(`${BASE}/${returnId}/items/${itemId}`, payload);
  return data;
};

export const removeSupplierReturnItem = async (returnId: string, itemId: string): Promise<void> => {
  await api.delete(`${BASE}/${returnId}/items/${itemId}`);
};

export const submitSupplierReturn = async (returnId: string): Promise<SupplierReturnDetail> => {
  const { data } = await api.post(`${BASE}/${returnId}/submit`);
  return data;
};

export const resolveSupplierReturn = async (returnId: string): Promise<SupplierReturnDetail> => {
  const { data } = await api.post(`${BASE}/${returnId}/resolve`);
  return data;
};

export const cancelSupplierReturn = async (returnId: string): Promise<SupplierReturnDetail> => {
  const { data } = await api.post(`${BASE}/${returnId}/cancel`);
  return data;
};
