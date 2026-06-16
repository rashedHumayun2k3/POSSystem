import { api } from './api';
import type { SupplierDto, CreateSupplierPayload, UpdateSupplierPayload } from '@/types/supplier';

export const listSuppliers = async (params?: {
  search?: string;
  limit?: number;
  sort?: 'recent' | 'name';
}): Promise<SupplierDto[]> => {
  const { data } = await api.get('/suppliers', { params });
  return data;
};

export const createSupplier = async (payload: CreateSupplierPayload): Promise<SupplierDto> => {
  const { data } = await api.post('/suppliers', payload);
  return data;
};

export const updateSupplier = async (id: string, payload: UpdateSupplierPayload): Promise<SupplierDto> => {
  const { data } = await api.put(`/suppliers/${id}`, payload);
  return data;
};

export const deleteSupplier = async (id: string): Promise<void> => {
  await api.delete(`/suppliers/${id}`);
};
