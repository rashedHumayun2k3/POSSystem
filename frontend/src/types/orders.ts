// ── Customer ──────────────────────────────────────────────────────────────────
export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  address?: string;
  creditLimit: number;
  storeCreditBalance: number;
  isSerialRejecter: boolean;
  recentReturnCount: number;
  recentOrderCount: number;
  orderCount: number;
  returnCount: number;
  lastOrderAt: string | null;
  unpaidBalance: number;
}

// Lightweight shape used for the offline POS local cache — identity/contact fields only, no
// financial data (see backend CustomerCacheDto).
export interface CustomerCacheEntry {
  id: string;
  name: string;
  phone: string;
  address: string | null;
}

export interface UpdateCustomerPayload {
  name: string;
  address?: string | null;
  creditLimit?: number | null;
  note?: string | null;
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
export type OrderChannel = 'FACEBOOK' | 'WHATSAPP' | 'INSTAGRAM' | 'PHONE' | 'SHOP' | 'HAWKER' | 'MYWEBSITE' | 'OTHER';
export type OrderStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
export type PaymentTerms = 'COD' | 'PREPAID' | 'CREDIT';
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
  availableStock: number;
}

export interface OrderPaymentDto {
  id: string;
  method: string;
  amount: number;
  receivedAt: string;
  recordedByName: string;
  paymentReference?: string | null;
}

export interface OrderStatusHistoryDto {
  track: string;
  fromStatus: string;
  toStatus: string;
  userName: string;
  at: string;
  // Only populated for track="ITEMS" (order revision) rows
  reason?: ReviseReasonType;
  note?: string;
}

export interface OrderEconomicsDto {
  revenue: number;
  cost: number;
  profit: number;
  discountAmount: number;
}

export interface OrderListItemSummary {
  imageUrl?: string | null;
  productName: string;
  variantSku: string;
  qty: number;
  availableStock: number;
  productId: string;
}

export interface OrderListItem {
  id: string;
  orderNo: string;
  channel: OrderChannel;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentTerms: PaymentTerms;
  fulfillmentStatus: FulfillmentStatus;
  isDraft: boolean;
  totalAmount: number;
  dueAmount: number;
  trackingNo?: string;
  handlingUserName?: string;
  createdAt: string;
  businessDate: string;
  items: OrderListItemSummary[];
  profit?: number; // owner/manager only — absent for STAFF, server-side gated
  isRevised: boolean;
  courierId?: string;
  courierName?: string;
  handedOverAt?: string; // used to compute "days in transit" on the delivery board
  branchId?: string;
  branchName?: string;
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
  paymentTerms: PaymentTerms;
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
  isRevised: boolean;
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
  advancePaymentReference?: string;
  paymentTerms?: PaymentTerms;
  note?: string;
  clientUid?: string;
  courierId?: string;
  businessDate?: string; // backdatable — e.g. hawker night-entry logging an earlier day's sale
  // R3.3 — set only when replaying a sale that already happened offline: accepts the sale even if
  // it drives stock negative, instead of rejecting it outright (which the online path still does).
  allowOversell?: boolean;
  // Explicit branch this order is for — overrides the ambient X-Branch-Id header. Lets the New
  // Order builder pin a branch up front so switching the header mid-session can't change which
  // branch's stock an in-progress order ends up committed against.
  branchId?: string;
}

export interface UpdateOrderPayload {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  channel?: string;
  discountType?: string;
  discountValue?: number;
  deliveryChargeCustomer?: number;
  note?: string;
  courierId?: string;
  // Draft-only full item replacement — see UpdateOrderRequest.Items on the backend.
  items?: OrderItemInput[];
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
  paymentReference?: string;
  method: string;
  amount: number;
  receivedAt?: string;
}

// ── Revise (reduce/remove line items, pre-fulfillment) ──────────────────────────

export type ReviseReasonType = 'OUT_OF_STOCK' | 'CUSTOMER_CHANGED_MIND' | 'OTHER';

export interface ReviseOrderItemInput {
  orderItemId: string;
  newQty: number; // 0 = remove the line entirely; must be less than the item's current qty
}

export interface ReviseOrderPayload {
  items: ReviseOrderItemInput[];
  reason: ReviseReasonType;
  note?: string; // required when reason is OTHER
  // Only needed if the API responds 409 ORDER_OVERPAID on a first attempt — resubmit the same
  // payload with these filled in. The refunded/credited amount is always server-computed.
  resolutionType?: 'REFUND' | 'STORE_CREDIT';
  refundMethod?: string; // required when resolutionType is REFUND
}

export interface OrderOverpaidError {
  code: 'ORDER_OVERPAID';
  message: string;
  excessAmount: number;
}
