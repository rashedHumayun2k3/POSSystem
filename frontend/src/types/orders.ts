// ── Customer ──────────────────────────────────────────────────────────────────
export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  address?: string;
  creditLimit: number;
  storeCreditBalance: number;
  isRejecterFlag: boolean;
  orderCount: number;
  unpaidBalance: number;
}

// ── Courier ───────────────────────────────────────────────────────────────────
export interface CourierDto {
  id: string;
  name: string;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  returnCharge: number;
  codFeeType: string;
  codFeeValue: number;
  contact?: string;
  trackingUrlTemplate?: string;
  isActive: boolean;
}

export interface DeliveryManDto {
  id: string;
  name: string;
  phone: string;
  courierId?: string;
  courierName?: string;
  costPerDelivery: number;
  isActive: boolean;
}

// ── Order ─────────────────────────────────────────────────────────────────────
export type OrderChannel = 'FACEBOOK' | 'WHATSAPP' | 'INSTAGRAM' | 'PHONE' | 'SHOP' | 'OTHER';
export type OrderStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
export type FulfillmentStatus = 'UNFULFILLED' | 'PACKED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED';

export interface OrderItemDto {
  id: string;
  variantId: string;
  variantSku: string;
  productName: string;
  variantLabel?: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  unitCostSnapshot?: number;
  lineProfit?: number;
  isDamagedItem: boolean;
}

export interface OrderPaymentDto {
  id: string;
  method: string;
  amount: number;
  receivedAt: string;
  recordedByName: string;
}

export interface OrderStatusHistoryDto {
  track: string;
  fromStatus: string;
  toStatus: string;
  userName: string;
  at: string;
}

export interface OrderEconomicsDto {
  revenue: number;
  cost: number;
  profit: number;
  discountAmount: number;
}

export interface OrderListItem {
  id: string;
  orderNo: string;
  channel: OrderChannel;
  customerName: string;
  customerPhone: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  isDraft: boolean;
  totalAmount: number;
  dueAmount: number;
  trackingNo?: string;
  handlingUserName?: string;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNo: string;
  channel: OrderChannel;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  isDraft: boolean;
  discountType?: string;
  discountValue?: number;
  deliveryChargeCustomer: number;
  deliveryCostActual: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  totalPaid: number;
  dueAmount: number;
  courierId?: string;
  courierName?: string;
  trackingNo?: string;
  deliveryManId?: string;
  deliveryManName?: string;
  handlingUserId?: string;
  handlingUserName?: string;
  note?: string;
  confirmedAt?: string;
  handedOverAt?: string;
  deliveredAt?: string;
  returnedAt?: string;
  cancelledReason?: string;
  returnResolution?: string;
  returnReason?: string;
  returnNote?: string;
  createdAt: string;
  createdByName: string;
  items: OrderItemDto[];
  payments: OrderPaymentDto[];
  statusHistory: OrderStatusHistoryDto[];
  economics?: OrderEconomicsDto;
}

// ── Request payloads ──────────────────────────────────────────────────────────
export interface OrderItemInput {
  variantId: string;
  qty: number;
  unitPrice: number;
}

export interface CreateOrderPayload {
  channel: OrderChannel;
  customerPhone: string;
  customerName: string;
  customerAddress?: string;
  isDraft: boolean;
  items: OrderItemInput[];
  discountType?: string;
  discountValue?: number;
  deliveryChargeCustomer: number;
  advancePaid: number;
  advancePaymentMethod?: string;
  note?: string;
  clientUid?: string;
  courierId?: string;
}

export interface UpdateOrderPayload {
  customerName?: string;
  customerAddress?: string;
  channel?: string;
  discountType?: string;
  discountValue?: number;
  deliveryChargeCustomer?: number;
  note?: string;
  courierId?: string;
}

export interface HandoverPayload {
  courierId: string;
  trackingNo: string;
  deliveryManId?: string;
  deliveryCostActual: number;
}

export interface ReturnItemInput {
  orderItemId: string;
  qty: number;
  inspection: 'SELLABLE' | 'DAMAGED';
}

export type ReturnResolutionType = 'COURIER_RETURN' | 'REFUND' | 'STORE_CREDIT' | 'REPLACE_SAME' | 'EXCHANGE_DIFFERENT';

export type ReturnReasonType = 'DEFECTIVE' | 'WRONG_SIZE_COLOR' | 'CHANGED_MIND' | 'DAMAGED_DELIVERY' | 'OTHER';

export interface ReturnOrderPayload {
  items: ReturnItemInput[];
  resolutionType: ReturnResolutionType;
  reason?: ReturnReasonType;
  refundAmount?: number;
  refundMethod?: string;
  note?: string;
}

export interface AddPaymentPayload {
  method: string;
  amount: number;
  receivedAt?: string;
}
