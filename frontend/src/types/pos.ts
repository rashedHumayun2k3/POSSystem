export interface PosCartItem {
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  unitPrice: number;
  qty: number;
  available: number;
  retailPrice: number; // the resolved retail-tier price (PriceOverride ?? SellingPrice), for recomputing unitPrice on qty change
  wholesaleMinQty: number | null; // both null = product has no wholesale tier
  wholesaleUnitPrice: number | null;
  // undefined = automatic (resolved from qty vs wholesaleMinQty); set only when staff taps the
  // override badge to force retail/wholesale pricing for this line regardless of quantity.
  manualPriceMode?: 'RETAIL' | 'WHOLESALE';
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
