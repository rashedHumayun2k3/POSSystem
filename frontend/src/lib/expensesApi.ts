import { api } from './api';
import type {
  ExpenseDto,
  CreateExpensePayload,
  PagedResult,
  PettyCashBoxDto,
  PettyCashTxnDto,
} from '@/types/expenses';

// ── Expenses ─────────────────────────────────────────────────────────────────
export const listExpenses = async (params?: {
  status?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedResult<ExpenseDto>> => {
  const { data } = await api.get('/expenses', { params });
  return data;
};

export const getExpense = async (id: string): Promise<ExpenseDto> => {
  const { data } = await api.get(`/expenses/${id}`);
  return data;
};

export const createExpense = async (payload: CreateExpensePayload): Promise<ExpenseDto> => {
  const { data } = await api.post('/expenses', payload);
  return data;
};

export const updateExpense = async (id: string, payload: CreateExpensePayload): Promise<ExpenseDto> => {
  const { data } = await api.put(`/expenses/${id}`, payload);
  return data;
};

export const deleteExpense = async (id: string): Promise<void> => {
  await api.delete(`/expenses/${id}`);
};

export const approveExpense = async (id: string, note?: string): Promise<ExpenseDto> => {
  const { data } = await api.post(`/expenses/${id}/approve`, { note: note ?? null });
  return data;
};

export const rejectExpense = async (id: string, reason: string): Promise<ExpenseDto> => {
  const { data } = await api.post(`/expenses/${id}/reject`, { reason });
  return data;
};

// ── Petty Cash ────────────────────────────────────────────────────────────────
export const listPettyCashBoxes = async (): Promise<PettyCashBoxDto[]> => {
  const { data } = await api.get('/petty-cash/boxes');
  return data;
};

export const fundPettyCash = async (boxId: string, amount: number, note?: string): Promise<PettyCashBoxDto> => {
  const { data } = await api.post(`/petty-cash/boxes/${boxId}/fund`, { amount, note });
  return data;
};

export const listPettyCashTxns = async (boxId: string, limit = 50): Promise<PettyCashTxnDto[]> => {
  const { data } = await api.get(`/petty-cash/boxes/${boxId}/txns`, { params: { limit } });
  return data;
};
