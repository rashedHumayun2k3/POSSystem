import { api } from './api';
import type {
  OrderListItem,
  OrderDetail,
  CreateOrderPayload,
  UpdateOrderPayload,
  HandoverPayload,
  ReturnOrderPayload,
  AddPaymentPayload,
  CustomerSummary,
  CourierDto,
  DeliveryManDto,
} from '@/types/orders';

const BASE = '/orders';

// ── Orders ────────────────────────────────────────────────────────────────────

export interface ListOrdersParams {
  orderStatus?: string;
  fulfillmentStatus?: string;
  channel?: string;
  q?: string;
  from?: string;
  to?: string;
}

export const listOrders = async (params: ListOrdersParams = {}): Promise<OrderListItem[]> => {
  const { data } = await api.get(BASE, { params });
  return data;
};

export const listOrdersByProduct = async (productId: string): Promise<OrderListItem[]> => {
  const { data } = await api.get(`/products/${productId}/orders`);
  return data;
};

export const getOrder = async (id: string): Promise<OrderDetail> => {
  const { data } = await api.get(`${BASE}/${id}`);
  return data;
};

export const createOrder = async (payload: CreateOrderPayload, idempotencyKey?: string): Promise<OrderDetail> => {
  const { data } = await api.post(BASE, payload, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
  return data;
};

export const confirmOrder = async (id: string): Promise<OrderDetail> => {
  const { data } = await api.post(`${BASE}/${id}/confirm`);
  return data;
};

export const packOrder = async (id: string): Promise<OrderDetail> => {
  const { data } = await api.post(`${BASE}/${id}/pack`);
  return data;
};

export const handoverOrder = async (id: string, payload: HandoverPayload): Promise<OrderDetail> => {
  const { data } = await api.post(`${BASE}/${id}/handover`, payload);
  return data;
};

export const deliverOrder = async (id: string): Promise<OrderDetail> => {
  const { data } = await api.post(`${BASE}/${id}/delivered`);
  return data;
};

export const returnOrder = async (id: string, payload: ReturnOrderPayload): Promise<OrderDetail> => {
  const { data } = await api.post(`${BASE}/${id}/return`, payload);
  return data;
};

export const updateOrder = async (id: string, payload: UpdateOrderPayload): Promise<OrderDetail> => {
  const { data } = await api.put(`${BASE}/${id}`, payload);
  return data;
};

export const deleteOrder = async (id: string, reason: string): Promise<void> => {
  await api.delete(`${BASE}/${id}`, { data: { reason } });
};

export const cancelOrder = async (id: string, reason: string): Promise<OrderDetail> => {
  const { data } = await api.post(`${BASE}/${id}/cancel`, { reason });
  return data;
};

export const addOrderPayment = async (id: string, payload: AddPaymentPayload): Promise<OrderDetail> => {
  const { data } = await api.post(`${BASE}/${id}/payments`, payload);
  return data;
};

export const downloadChallan = async (id: string): Promise<void> => {
  const response = await api.get(`${BASE}/${id}/challan`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const win = window.open(url, '_blank');
  // Revoke after the window has had time to load the blob
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  if (!win) {
    // Fallback: force download if popup was blocked
    const a = document.createElement('a');
    a.href = url;
    a.download = `challan-${id}.pdf`;
    a.click();
  }
};

export const downloadReceipt = async (id: string): Promise<void> => {
  const response = await api.get(`${BASE}/${id}/receipt`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const win = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${id}.pdf`;
    a.click();
  }
};

export const claimOrder = async (id: string): Promise<void> => {
  await api.post(`${BASE}/${id}/claim`);
};

// ── Customers ─────────────────────────────────────────────────────────────────

export const searchCustomers = async (q: string): Promise<CustomerSummary[]> => {
  const { data } = await api.get('/customers', { params: { q } });
  return data;
};

export const getCustomerByPhone = async (phone: string): Promise<CustomerSummary | null> => {
  try {
    const { data } = await api.get('/customers/by-phone', { params: { phone } });
    return data;
  } catch {
    return null;
  }
};

// ── Couriers ──────────────────────────────────────────────────────────────────

export const listCouriers = async (): Promise<CourierDto[]> => {
  const { data } = await api.get('/couriers');
  return data;
};

export const listDeliveryMen = async (): Promise<DeliveryManDto[]> => {
  const { data } = await api.get('/couriers/delivery-men');
  return data;
};
