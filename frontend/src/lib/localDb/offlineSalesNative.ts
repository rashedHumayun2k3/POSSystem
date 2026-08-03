import { getLocalDb } from './sqliteClient';
import { createOrder, addOrderPayment } from '../ordersApi';
import { isNetworkError } from '../networkError';
import type { OfflineSale, OfflineSaleItem } from '@/types/offlineSale';

type QueueListener = () => void;
const listeners = new Set<QueueListener>();

// Anything that mutates offline_sales calls this so usePendingSalesCount's polling picks up the
// change immediately on its next tick instead of waiting out the full poll interval.
function notifyQueueChanged(): void {
  listeners.forEach((l) => l());
}
export function subscribeNativeQueueChanged(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function rowToSale(row: Record<string, unknown>): OfflineSale {
  return {
    id: row.id as string,
    channel: row.channel as OfflineSale['channel'],
    customerName: row.customerName as string,
    customerPhone: row.customerPhone as string,
    items: JSON.parse(row.itemsJson as string) as OfflineSaleItem[],
    discountType: (row.discountType as OfflineSale['discountType']) ?? undefined,
    discountValue: (row.discountValue as number) ?? undefined,
    note: (row.note as string) ?? undefined,
    method: row.method as OfflineSale['method'],
    paidAmount: row.paidAmount as number,
    total: row.total as number,
    businessDate: (row.businessDate as string) ?? undefined,
    createdAt: row.createdAt as number,
    status: row.status as OfflineSale['status'],
    orderId: (row.orderId as string) ?? undefined,
    paid: !!row.paid,
    attempts: row.attempts as number,
    lastError: (row.lastError as string) ?? undefined,
  };
}

export async function enqueueOfflineSaleNative(sale: Omit<OfflineSale, 'status' | 'attempts'>): Promise<void> {
  const db = await getLocalDb();
  await db.run(
    `INSERT INTO offline_sales
      (id, channel, customerName, customerPhone, itemsJson, discountType, discountValue, note,
       method, paidAmount, total, businessDate, createdAt, status, orderId, paid, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, 0, 0)`,
    [
      sale.id, sale.channel, sale.customerName, sale.customerPhone, JSON.stringify(sale.items),
      sale.discountType ?? null, sale.discountValue ?? null, sale.note ?? null,
      sale.method, sale.paidAmount, sale.total, sale.businessDate ?? null, sale.createdAt,
    ]
  );
  notifyQueueChanged();
}

export async function getPendingCountNative(): Promise<number> {
  const db = await getLocalDb();
  const result = await db.query(
    `SELECT COUNT(*) as cnt FROM offline_sales WHERE status IN ('PENDING','SYNCING','FAILED')`
  );
  return (result.values?.[0]?.cnt as number) ?? 0;
}

// Flattened line items across every not-yet-synced sale — the source of truth for "what's still
// queued, per product" (e.g. hawker/night-entry's tile numbers), read straight from the persisted
// queue rather than a React state tally that would reset on reload.
export async function getPendingSaleItemsNative(): Promise<OfflineSaleItem[]> {
  const db = await getLocalDb();
  const result = await db.query(
    `SELECT itemsJson FROM offline_sales WHERE status IN ('PENDING','SYNCING','FAILED')`
  );
  const items: OfflineSaleItem[] = [];
  for (const row of result.values ?? []) {
    items.push(...(JSON.parse(row.itemsJson as string) as OfflineSaleItem[]));
  }
  return items;
}

async function getSyncableSales(): Promise<OfflineSale[]> {
  const db = await getLocalDb();
  const result = await db.query(
    `SELECT * FROM offline_sales WHERE status IN ('PENDING','FAILED') ORDER BY createdAt ASC`
  );
  return (result.values ?? []).map(rowToSale);
}

async function updateSale(id: string, patch: Record<string, unknown>): Promise<void> {
  const db = await getLocalDb();
  const cols = Object.keys(patch);
  const setClause = cols.map((c) => `${c} = ?`).join(', ');
  await db.run(`UPDATE offline_sales SET ${setClause} WHERE id = ?`, [...cols.map((c) => patch[c]), id]);
  notifyQueueChanged();
}

function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string } } })?.response;
  if (response?.data?.message) return response.data.message;
  return err instanceof Error ? err.message : 'Sync failed';
}

// Same 2-call shape and same resumability reasoning as the web (Dexie) sync engine in
// posSync.ts — see that file for why createOrder alone (isDraft:false) already confirms, and why
// allowOversell is set here specifically (R3.3: an offline sale can't be un-sold on sync).
async function syncOneNative(sale: OfflineSale): Promise<'synced' | 'failed' | 'offline'> {
  await updateSale(sale.id, { status: 'SYNCING' });
  try {
    let orderId = sale.orderId;

    if (!orderId) {
      const order = await createOrder(
        {
          channel: sale.channel,
          customerPhone: sale.customerPhone || '00000000000',
          customerName: sale.customerName || 'Walk-in',
          isDraft: false,
          items: sale.items,
          discountType: sale.discountType,
          discountValue: sale.discountValue,
          deliveryChargeCustomer: 0,
          advancePaid: 0,
          note: sale.note,
          clientUid: sale.id,
          allowOversell: true,
          businessDate: sale.businessDate,
        },
        sale.id
      );
      orderId = order.id;
      await updateSale(sale.id, { orderId });
    }

    if (!sale.paid) {
      await addOrderPayment(orderId, { method: sale.method, amount: sale.paidAmount });
      await updateSale(sale.id, { paid: 1 });
    }

    await updateSale(sale.id, { status: 'SYNCED' });
    return 'synced';
  } catch (err) {
    if (isNetworkError(err)) {
      await updateSale(sale.id, { status: 'PENDING' });
      return 'offline';
    }
    await updateSale(sale.id, { status: 'FAILED', attempts: sale.attempts + 1, lastError: errorMessage(err) });
    return 'failed';
  }
}

let syncInFlight = false;

export async function syncOfflineSalesNative(): Promise<void> {
  if (syncInFlight) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  syncInFlight = true;
  try {
    const pending = await getSyncableSales();
    for (const sale of pending) {
      const result = await syncOneNative(sale);
      if (result === 'offline') break;
    }
  } finally {
    syncInFlight = false;
  }
}
