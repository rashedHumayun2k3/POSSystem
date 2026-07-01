import { api } from './api';

export interface CourierCodSummary {
  courierId: string;
  courierName: string;
  pendingOrderCount: number;
  totalCodReceivable: number;
  remittanceHistoryCount: number;
}

export interface OrderInCourierBoard {
  orderId: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paidAmount: number;
  codAmount: number;
  fulfillmentStatus: string;
  codRemittanceStatus: string | null;
  deliveredAt: string | null;
  trackingNo: string | null;
}

export interface CourierRemittanceRecord {
  id: string;
  remittanceNo: string;
  courierId: string;
  courierName: string;
  amount: number;
  remittedAt: string;
  method: string;
  reference: string | null;
  note: string | null;
  orderCount: number;
  recordedByName: string;
  createdAt: string;
}

export interface CreateRemittancePayload {
  courierId: string;
  orderIds: string[];
  amount: number;
  method: string; // BANK | BKASH | NAGAD | CASH
  reference?: string;
  remittedAt: string;
  note?: string;
}

const BASE = '/remittances';

export const getRemittanceSummary = async (): Promise<CourierCodSummary[]> => {
  const { data } = await api.get(`${BASE}/summary`);
  return data;
};

export const getCourierOrders = async (
  courierId: string,
  status?: string
): Promise<OrderInCourierBoard[]> => {
  const { data } = await api.get(`${BASE}/courier/${courierId}/orders`, {
    params: status ? { status } : undefined,
  });
  return data;
};

export const listRemittances = async (): Promise<CourierRemittanceRecord[]> => {
  const { data } = await api.get(BASE);
  return data;
};

export const createRemittance = async (
  payload: CreateRemittancePayload
): Promise<CourierRemittanceRecord> => {
  const { data } = await api.post(BASE, payload);
  return data;
};
