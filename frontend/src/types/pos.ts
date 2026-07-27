export interface PosCartItem {
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  unitPrice: number;
  qty: number;
  available: number;
}

export type PosSessionStatus = 'SCANNING' | 'AWAITING_PAYMENT' | 'PROCESSING';

export interface PosSession {
  id: string;          // UUID — also used as idempotency key for the eventual order
  label: string;       // A, B, C, D, E
  status: PosSessionStatus;
  items: PosCartItem[];
  customerName: string;
  customerPhone: string;
  customerId?: string;
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PosShift {
  id: string;
  openedAt: string;      // ISO timestamp
  openingFloat: number;
  cashierName: string;
  salesCount: number;
  totalSales: number;    // sum of order totals
  totalCash: number;     // cash-method payments only
}
