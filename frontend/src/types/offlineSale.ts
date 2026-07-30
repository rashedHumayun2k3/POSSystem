// A POS sale that couldn't reach the server at checkout time, queued locally instead of failing.
// `id` doubles as the eventual order's Idempotency-Key/ClientUid — same pattern PosSession
// already uses for the online path, so a sale created offline and later synced is exactly as
// duplicate-safe as one created online (OrderService.CreateAsync dedupes on ClientUid).
//
// Completing a sale is 2 sequential API calls: createOrder (isDraft:false auto-confirms — commits
// stock — as part of that same call) then addOrderPayment. orderId/paid track how far a given
// queued sale got, so a sync that dies partway (connection drops again mid-sync) resumes from
// there instead of restarting or re-creating the order.
export type OfflineSaleStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface OfflineSaleItem {
  variantId: string;
  qty: number;
  unitPrice: number;
}

export interface OfflineSale {
  id: string; // = originating PosSession.id
  channel: 'SHOP' | 'HAWKER';
  customerName: string;
  customerPhone: string;
  items: OfflineSaleItem[];
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  note?: string;
  method: 'CASH' | 'BKASH' | 'CARD';
  paidAmount: number;
  total: number;
  businessDate?: string; // hawker night-entry backdating — preserved through sync so a sale logged
                          // for an earlier day doesn't get today's date just because it synced late
  createdAt: number; // client-side timestamp — local ordering/display only, not sent to the server
  status: OfflineSaleStatus;
  orderId?: string; // set once createOrder (which also confirms) succeeds during sync
  paid?: boolean; // set once addOrderPayment succeeds
  attempts: number;
  lastError?: string;
}
