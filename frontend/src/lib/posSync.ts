import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createOrder, addOrderPayment } from './ordersApi';
import { posDb } from './posDb';
import { isNetworkError } from './networkError';
import { isNativeApp } from './platform';
import {
  enqueueOfflineSaleNative,
  getPendingCountNative,
  getPendingSaleItemsNative,
  syncOfflineSalesNative,
  subscribeNativeQueueChanged,
} from './localDb/offlineSalesNative';
import type { OfflineSale, OfflineSaleItem } from '@/types/offlineSale';

export { isNetworkError };

// Native (Capacitor/Android): SQLite, shared with the product catalog cache (see
// localDb/offlineSalesNative.ts) — chosen so the app has one local storage mechanism, not two.
// Web (plain browser, including an installed PWA): Dexie/IndexedDB, unchanged from before the
// native path existed. Same public API either way — callers never need to know which backend is
// underneath.
export async function enqueueOfflineSale(sale: Omit<OfflineSale, 'status' | 'attempts'>): Promise<void> {
  if (isNativeApp()) {
    await enqueueOfflineSaleNative(sale);
    return;
  }
  await posDb.offlineSales.add({ ...sale, status: 'PENDING', attempts: 0 });
}

function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string } } })?.response;
  if (response?.data?.message) return response.data.message;
  return err instanceof Error ? err.message : 'Sync failed';
}

// Completing a sale is 2 sequential calls, not 1 — orderId/paid on the record track how far a
// previous attempt got, so a sync that drops mid-way (connection lost again) resumes from there
// next time instead of re-creating the order (ClientUid dedup would catch that anyway, but
// resuming avoids the redundant call and a possible double payment record).
async function syncOne(sale: OfflineSale): Promise<'synced' | 'failed' | 'offline'> {
  await posDb.offlineSales.update(sale.id, { status: 'SYNCING' });
  try {
    let orderId = sale.orderId;

    if (!orderId) {
      // isDraft:false makes this call also confirm (commit stock) in the same request — no
      // separate confirm step. allowOversell:true is what makes R3.3's exception apply: this sale
      // already happened physically, so it can't be un-sold just because sync discovers the
      // stock isn't there anymore — the backend logs it (Activity Log: "OVERSOLD") instead of
      // rejecting the order outright the way a live/online sale would be.
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
      await posDb.offlineSales.update(sale.id, { orderId });
    }

    if (!sale.paid) {
      await addOrderPayment(orderId, { method: sale.method, amount: sale.paidAmount });
      await posDb.offlineSales.update(sale.id, { paid: true });
    }

    await posDb.offlineSales.update(sale.id, { status: 'SYNCED' });
    return 'synced';
  } catch (err) {
    if (isNetworkError(err)) {
      await posDb.offlineSales.update(sale.id, { status: 'PENDING' });
      return 'offline';
    }
    await posDb.offlineSales.update(sale.id, {
      status: 'FAILED',
      attempts: sale.attempts + 1,
      lastError: errorMessage(err),
    });
    return 'failed';
  }
}

let syncInFlight = false;

// Drains the queue oldest-first (web/Dexie path). Stops the whole pass as soon as one sale comes
// back as a network error (still offline, or dropped again mid-sync) rather than burning through
// timeouts on every remaining item — the next 'online' event or interval tick picks up where this
// left off.
async function syncOfflineSalesWeb(): Promise<void> {
  if (syncInFlight) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  syncInFlight = true;
  try {
    const pending = await posDb.offlineSales
      .where('status')
      .anyOf('PENDING', 'FAILED')
      .sortBy('createdAt');

    for (const sale of pending) {
      const result = await syncOne(sale);
      if (result === 'offline') break;
    }
  } finally {
    syncInFlight = false;
  }
}

export async function syncOfflineSales(): Promise<void> {
  if (isNativeApp()) {
    await syncOfflineSalesNative();
    return;
  }
  await syncOfflineSalesWeb();
}

// Wires up automatic sync triggers — call once near the top of the POS screen. Three triggers:
// the 'online' event (fires the moment connectivity returns), a mount-time attempt (in case the
// app was reopened already online with sales queued from a previous session), and a 20s interval
// safety net (the 'online' event isn't always reliable inside a PWA/service-worker context).
export function useOfflineSyncEngine(): void {
  useEffect(() => {
    syncOfflineSales();
    window.addEventListener('online', syncOfflineSales);
    const interval = setInterval(syncOfflineSales, 20_000);
    return () => {
      window.removeEventListener('online', syncOfflineSales);
      clearInterval(interval);
    };
  }, []);
}

// Live count for the SyncPill — anything not yet fully synced. FAILED is included deliberately:
// those need a human to look at them (real stock/validation rejection, not connectivity), but
// they're still "not done" from the cashier's point of view.
//
// Both hooks below are always called (rules of hooks — which branch's *result* gets used is the
// only thing that varies), so this is safe despite looking conditional.
export function usePendingSalesCount(): number {
  const dexieCount = useLiveQuery(
    () => posDb.offlineSales.where('status').anyOf('PENDING', 'SYNCING', 'FAILED').count(),
    [],
    0
  );

  const [nativeCount, setNativeCount] = useState(0);
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const refresh = () => { getPendingCountNative().then((c) => { if (!cancelled) setNativeCount(c); }); };
    refresh();
    const interval = setInterval(refresh, 4000);
    const unsubscribe = subscribeNativeQueueChanged(refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return isNativeApp() ? nativeCount : (dexieCount ?? 0);
}

// Flattened line items across every not-yet-synced sale, live — the persisted-storage source of
// truth for "what's queued right now, per product." Exists so a screen like hawker/night-entry can
// show pending offline sales in its numbers without keeping its own React-state tally, which would
// reset to nothing on every reload/navigation even though the sales themselves are still safely
// queued. Same always-call-both-hooks reasoning as usePendingSalesCount above.
const EMPTY_ITEMS: OfflineSaleItem[] = [];

export function usePendingSaleItems(): OfflineSaleItem[] {
  const dexieSales = useLiveQuery(
    () => posDb.offlineSales.where('status').anyOf('PENDING', 'SYNCING', 'FAILED').toArray(),
    [],
    []
  );

  const [nativeItems, setNativeItems] = useState<OfflineSaleItem[]>(EMPTY_ITEMS);
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const refresh = () => { getPendingSaleItemsNative().then((items) => { if (!cancelled) setNativeItems(items); }); };
    refresh();
    const interval = setInterval(refresh, 4000);
    const unsubscribe = subscribeNativeQueueChanged(refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  if (isNativeApp()) return nativeItems;
  return (dexieSales ?? []).flatMap((sale) => sale.items);
}

function subscribeToConnectivity(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeToConnectivity, () => navigator.onLine, () => true);
}
