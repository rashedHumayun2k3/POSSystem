import { api } from './api';
import type {
  OrderListItem,
  OrderDetail,
  CreateOrderPayload,
  UpdateOrderPayload,
  ReviseOrderPayload,
  HandoverPayload,
  ReturnOrderPayload,
  AddPaymentPayload,
  CustomerSummary,
  CustomerCacheEntry,
  UpdateCustomerPayload,
  CourierDto,
  DeliveryManDto,
} from '@/types/orders';

const BASE = '/orders';

export interface InvoiceListItem {
  id: string;
  orderNo: string;
  channel: string;
  customerName: string;
  businessDate: string;
  totalAmount: number;
  totalPaid: number;
  dueAmount: number;
}

export const listInvoices = async (q: string, page: number, filters: { from?: string; to?: string; payment?: string; today?: string } = {}): Promise<{
  items: InvoiceListItem[]; totalCount: number; page: number; pageSize: number;
  summary: { date: string; total: number; paid: number; due: number };
}> => {
  const { data } = await api.get(`${BASE}/invoices`, { params: { q, page, pageSize: 20, ...filters } });
  return data;
};

// ── Orders ────────────────────────────────────────────────────────────────────

export interface ListOrdersParams {
  orderStatus?: string;
  fulfillmentStatus?: string;
  paymentStatus?: string;
  channel?: string;
  q?: string;
  // Independent of q — AND-able filters backing the Filter sheet's own Customer/Product fields,
  // separate from the plain quick-search box (see OrderService.ListAsync).
  customerQuery?: string;
  productQuery?: string;
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

export const reviseOrder = async (id: string, payload: ReviseOrderPayload): Promise<OrderDetail> => {
  const { data } = await api.post(`${BASE}/${id}/revise`, payload);
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

const openOrderPdf = async (id: string, document: 'receipt' | 'invoice'): Promise<void> => {
  const response = await api.get(`${BASE}/${id}/${document}`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const win = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  if (!win) {
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document}-${id}.pdf`;
    a.click();
  }
};

export interface OrderManagementPage {
  items: OrderListItem[];
  counts: Record<string, number>;
  totalCount: number;
  page: number;
  pageSize: number;
}

export const listOrderManagement = async (params: ListOrdersParams & { tab: string; page: number }, signal?: AbortSignal): Promise<OrderManagementPage> => {
  const { data } = await api.get(`${BASE}/management`, { params, signal });
  return data;
};

export const downloadReceipt = (id: string): Promise<void> => openOrderPdf(id, 'receipt');
export interface InvoicePreview {
  orderNo: string;
  customerName: string;
  pages: string[];
  invoice: MobileInvoice;
}

export interface MobileInvoice {
  documentNumber: string;
  invoiceDate: string;
  orderDate: string;
  sellerName: string;
  sellerAddress: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  sellerWebsite: string | null;
  logo: string | null;
  contactLink: string | null;
  customerAddress: string | null;
  customerPhone: string | null;
  currency: string;
  paymentMethods: string;
  items: { itemId: string; description: string; variant: string; sku: string;
    qty: string; unitPrice: string; discount: string; totalPrice: string }[];
  subtotal: string;
  discount: string;
  shipping: string;
  total: string;
  paid: string;
  due: string;
  credit: string | null;
}

export const getInvoicePreview = async (id: string, mobile = false): Promise<InvoicePreview> => {
  const { data } = await api.get(`${BASE}/${id}/invoice/preview`, { params: { mobile } });
  return data;
};

export const downloadInvoice = async (id: string, orderNo: string, mobile = false): Promise<void> => {
  const { data } = await api.get(`${BASE}/${id}/invoice`, { params: { mobile }, responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${orderNo.replace(/[^a-zA-Z0-9_-]/g, '-')}${mobile ? '-mobile' : ''}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

export const claimOrder = async (id: string): Promise<void> => {
  await api.post(`${BASE}/${id}/claim`);
};

// ── Customers ─────────────────────────────────────────────────────────────────

export const searchCustomers = async (q: string): Promise<CustomerSummary[]> => {
  const { data } = await api.get('/customers', { params: { q } });
  return data;
};

export const getCustomerCache = async (): Promise<CustomerCacheEntry[]> => {
  const { data } = await api.get('/customers/cache');
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

export const getCustomer = async (id: string): Promise<CustomerSummary> => {
  const { data } = await api.get(`/customers/${id}`);
  return data;
};

export const updateCustomer = async (id: string, payload: UpdateCustomerPayload): Promise<CustomerSummary> => {
  const { data } = await api.put(`/customers/${id}`, payload);
  return data;
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

export const createDeliveryMan = async (payload: {
  name: string;
  phone: string;
  courierId?: string;
  costPerDelivery: number;
}): Promise<DeliveryManDto> => {
  const { data } = await api.post('/couriers/delivery-men', payload);
  return data;
};
