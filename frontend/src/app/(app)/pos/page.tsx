'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { liveQuery } from 'dexie';
import { posDb } from '@/lib/posDb';
import type { PosSession, PosShift } from '@/types/pos';
import type { PayMethod } from '@/components/pos/PaymentModal';
import { useAuthStore } from '@/store/authStore';
import SessionTray from '@/components/pos/SessionTray';
import CartPanel from '@/components/pos/CartPanel';
import PaymentModal from '@/components/pos/PaymentModal';
import ShiftModal from '@/components/pos/ShiftModal';
import SaleSuccessModal from '@/components/pos/SaleSuccessModal';
import SyncPill from '@/components/pos/SyncPill';
import { useOfflineSyncEngine } from '@/lib/posSync';
import { useCatalogAutoSync } from '@/lib/localDb/catalogCache';
import { Toast } from '@/components/ui/Toast';
import { browseProducts } from '@/lib/catalogApi';
import type { PosCartItem } from '@/types/pos';
import type { ProductSearchResult } from '@/types/catalog';

const SESSION_LABELS = ['A', 'B', 'C', 'D', 'E'];
const MAX_SESSIONS = 5;

function nextLabel(sessions: PosSession[]): string {
  const used = new Set(sessions.map(s => s.label));
  return SESSION_LABELS.find(l => !used.has(l)) ?? 'X';
}

function formatDuration(isoStart: string): string {
  const ms = Date.now() - new Date(isoStart).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function loadShift(): PosShift | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('pos_shift');
    return raw ? (JSON.parse(raw) as PosShift) : null;
  } catch {
    localStorage.removeItem('pos_shift');
    return null;
  }
}

function saveShift(shift: PosShift) {
  localStorage.setItem('pos_shift', JSON.stringify(shift));
}

interface CompletedSale {
  orderId: string;
  orderNo: string;
  total: number;
  paidAmount: number;
  method: PayMethod;
  customerPhone?: string;
  // true = queued locally, not actually on the server yet (orderId/orderNo are placeholders) —
  // see PaymentModal.handleConfirm and lib/posSync.ts.
  offline: boolean;
}

export default function PosPage() {
  useOfflineSyncEngine();
  useCatalogAutoSync();

  const user = useAuthStore(s => s.user);
  const cashierName = user?.name ?? user?.phone ?? 'Cashier';
  const businesses = useAuthStore(s => s.businesses);
  const currentBusinessId = useAuthStore(s => s.currentBusinessId);
  const businessName = businesses.find(b => b.id === currentBusinessId)?.name ?? '';

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [shift, setShift] = useState<PosShift | null>(null);
  const [shiftModalMode, setShiftModalMode] = useState<'open' | 'close' | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [shiftDuration, setShiftDuration] = useState('');
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  // Load shift on mount
  useEffect(() => {
    const saved = loadShift();
    if (saved) {
      setShift(saved);
      setShiftDuration(formatDuration(saved.openedAt));
    } else {
      setShiftModalMode('open');
    }
  }, []);

  // Tick shift duration every minute
  useEffect(() => {
    if (!shift) return;
    setShiftDuration(formatDuration(shift.openedAt));
    const id = setInterval(() => setShiftDuration(formatDuration(shift.openedAt)), 60_000);
    return () => clearInterval(id);
  }, [shift]);

  // Live sessions from Dexie (IndexedDB) via liveQuery subscription
  const [sessions, setSessions] = useState<PosSession[]>([]);
  useEffect(() => {
    const sub = liveQuery(() =>
      posDb.sessions.orderBy('createdAt').toArray()
    ).subscribe({
      next: (rows) => setSessions(rows),
      error: () => setSessions([]),
    });
    return () => sub.unsubscribe();
  }, []);

  const createSession = useCallback(async () => {
    const all = await posDb.sessions.orderBy('createdAt').toArray();
    if (all.length >= MAX_SESSIONS) return;
    const id = crypto.randomUUID();
    const session: PosSession = {
      id,
      label: nextLabel(all),
      status: 'SCANNING',
      items: [],
      customerName: '',
      customerPhone: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await posDb.sessions.add(session);
    setActiveSessionId(id);
  }, []);

  // Auto-create first session once shift is open. Guarded by a ref (not just the sessions.length
  // check) because Dexie's liveQuery can report "still empty" more than once in quick succession
  // while the new session is being written — without the guard, two createSession() calls can
  // both be in flight at the same empty-sessions moment and both land, leaving two sessions
  // instead of one (e.g. right after discarding the last remaining session).
  const autoCreatingRef = useRef(false);
  useEffect(() => {
    if (!shift || shiftModalMode) return;
    if (sessions.length === 0) {
      if (autoCreatingRef.current) return;
      autoCreatingRef.current = true;
      createSession().finally(() => { autoCreatingRef.current = false; });
    } else if (!activeSessionId || !sessions.find((s: PosSession) => s.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id);
    }
  }, [shift, sessions, activeSessionId, shiftModalMode, createSession]);

  const loadDemoSessions = useCallback(async () => {
    const products = await browseProducts(undefined, true);
    if (products.length === 0) {
      setToast({ msg: 'No products found — add some products first.', type: 'error' });
      return;
    }

    function toCartItem(p: ProductSearchResult, qty: number): PosCartItem {
      let variantLabel = '';
      try {
        const obj = JSON.parse(p.variantValuesJson) as Record<string, string>;
        variantLabel = Object.values(obj).filter(Boolean).join(' / ');
      } catch { /* default variant */ }
      return {
        variantId: p.variantId,
        productName: p.productName,
        variantLabel,
        sku: p.variantSku,
        unitPrice: p.sellingPrice,
        qty,
        available: p.stock,
        retailPrice: p.sellingPrice,
        wholesaleMinQty: p.wholesaleMinQty,
        wholesaleUnitPrice: p.wholesaleUnitPrice,
      };
    }

    const all = await posDb.sessions.orderBy('createdAt').toArray();
    const used = new Set(all.map((s: PosSession) => s.label));
    const freeLabels = SESSION_LABELS.filter(l => !used.has(l));
    if (freeLabels.length === 0) {
      setToast({ msg: 'Already at maximum sessions (5).', type: 'error' });
      return;
    }

    const now = Date.now();
    const demoSessions: PosSession[] = [];

    // Session 1: customer with 3 items, one qty=2, awaiting payment
    if (freeLabels[0] && products.length >= 1) {
      const items = [
        toCartItem(products[0], 2),
        ...(products[1] ? [toCartItem(products[1], 1)] : []),
        ...(products[2] ? [toCartItem(products[2], 1)] : []),
      ];
      demoSessions.push({
        id: crypto.randomUUID(),
        label: freeLabels[0],
        status: 'AWAITING_PAYMENT',
        items,
        customerName: 'Rahim Khan',
        customerPhone: '01711223344',
        discountType: 'FIXED',
        discountValue: 50,
        createdAt: now - 3 * 60_000,
        updatedAt: now - 1 * 60_000,
      });
    }

    // Session 2: walk-in with 2 items, still scanning
    if (freeLabels[1] && products.length >= 2) {
      const items = [
        toCartItem(products[products.length - 1], 3),
        ...(products.length >= 3 ? [toCartItem(products[Math.floor(products.length / 2)], 1)] : []),
      ];
      demoSessions.push({
        id: crypto.randomUUID(),
        label: freeLabels[1],
        status: 'SCANNING',
        items,
        customerName: '',
        customerPhone: '',
        createdAt: now - 1 * 60_000,
        updatedAt: now,
      });
    }

    await posDb.sessions.bulkAdd(demoSessions);
    if (demoSessions[0]) setActiveSessionId(demoSessions[0].id);
    setToast({ msg: `${demoSessions.length} demo session${demoSessions.length !== 1 ? 's' : ''} loaded.`, type: 'success' });
  }, []);

  // Cart sessions cache each item's variantId/name/price at the moment it's added and never
  // re-check against the server afterward — if products get renamed/re-priced/re-seeded, old
  // sessions can end up showing stale text next to a variantId that no longer matches. This is
  // the manual escape hatch for that (was previously only fixable via clearing IndexedDB by hand).
  const clearAllSessions = useCallback(async () => {
    if (!window.confirm('Discard ALL open cart sessions on this device? This cannot be undone.')) return;
    await posDb.sessions.clear();
    setActiveSessionId(null);
    setToast({ msg: 'All cart sessions cleared.', type: 'success' });
  }, []);

  const handleDiscard = useCallback(async (id: string) => {
    await posDb.sessions.delete(id);
    // If the discarded session was active, fall back to another or create fresh
    if (id === activeSessionId) {
      setActiveSessionId(null);
    }
  }, [activeSessionId]);

  const handleShiftOpen = (newShift: PosShift) => {
    saveShift(newShift);
    setShift(newShift);
    setShiftModalMode(null);
  };

  const handlePaymentSuccess = async (
    method: PayMethod,
    paidAmount: number,
    orderTotal: number,
    orderId: string,
    orderNo: string,
    offline: boolean
  ) => {
    setPaymentOpen(false);

    const finishedSession = sessions.find((s: PosSession) => s.id === activeSessionId) ?? null;

    // Update shift running totals
    if (shift) {
      const updated: PosShift = {
        ...shift,
        salesCount: shift.salesCount + 1,
        totalSales: shift.totalSales + orderTotal,
        totalCash: shift.totalCash + (method === 'CASH' ? paidAmount : 0),
      };
      saveShift(updated);
      setShift(updated);
    }

    // Remove completed session from Dexie
    if (activeSessionId) {
      await posDb.sessions.delete(activeSessionId);
      setActiveSessionId(null);
    }

    setCompletedSale({
      orderId,
      orderNo,
      total: orderTotal,
      paidAmount,
      method,
      customerPhone: finishedSession?.customerPhone || undefined,
      offline,
    });
  };

  const activeSession = sessions.find((s: PosSession) => s.id === activeSessionId) ?? null;
  const canAddMore = sessions.length < MAX_SESSIONS;

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">

      {/* Shift status bar */}
      {shift && (
        <div className="print:hidden shrink-0 bg-indigo-700 text-white px-3 py-1.5 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2 min-w-0">
            <SyncPill />
            <span className="opacity-40 shrink-0">|</span>
            <svg className="w-3.5 h-3.5 opacity-70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium truncate">{shift.cashierName}</span>
            <span className="opacity-60 shrink-0">· {shiftDuration}</span>
            <span className="opacity-60 shrink-0">· float ৳{shift.openingFloat.toLocaleString()}</span>
            {shift.salesCount > 0 && (
              <span className="opacity-60 shrink-0">· {shift.salesCount} sale{shift.salesCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="shrink-0 ml-3 flex items-center gap-3">
            <button
              onClick={loadDemoSessions}
              className="text-indigo-300 hover:text-white font-medium border border-indigo-500 hover:border-indigo-300 rounded px-2 py-0.5 transition-colors"
              title="Seed demo sessions with real products"
            >
              Load demo
            </button>
            <button
              onClick={clearAllSessions}
              className="text-red-300 hover:text-white font-medium border border-red-400 hover:border-red-300 rounded px-2 py-0.5 transition-colors"
              title="Discard all cart sessions on this device (fixes stale/mismatched cart data)"
            >
              Clear sessions
            </button>
            <button
              onClick={() => setShiftModalMode('close')}
              className="text-indigo-200 hover:text-white font-medium"
            >
              End Shift
            </button>
          </div>
        </div>
      )}

      {/* Main body — column on mobile (chips on top), row on tablet (sidebar) */}
      <div className="print:hidden flex flex-col md:flex-row flex-1 min-h-0">

        {/* Session tray: horizontal chips on mobile, sidebar on tablet */}
        {sessions.length > 0 && (
          <SessionTray
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={setActiveSessionId}
            onNew={createSession}
            onDiscard={handleDiscard}
            canAddMore={canAddMore}
          />
        )}

        {/* Cart panel */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {!shift && !shiftModalMode ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Open a shift to begin selling.
            </div>
          ) : activeSession ? (
            <CartPanel
              key={activeSession.id}
              session={activeSession}
              onPayClick={() => setPaymentOpen(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Starting session…
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {paymentOpen && activeSession && (
        <PaymentModal
          session={activeSession}
          onClose={() => setPaymentOpen(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Sale success — print/WhatsApp receipt, then start a new sale */}
      {completedSale && (
        <SaleSuccessModal
          orderId={completedSale.orderId}
          orderNo={completedSale.orderNo}
          total={completedSale.total}
          paidAmount={completedSale.paidAmount}
          method={completedSale.method}
          customerPhone={completedSale.customerPhone}
          offline={completedSale.offline}
          businessName={businessName}
          onNewSale={() => setCompletedSale(null)}
        />
      )}

      {/* Shift modal (open or close/Z-report) */}
      {shiftModalMode && (
        <ShiftModal
          mode={shiftModalMode}
          shift={shift}
          cashierName={cashierName}
          onOpen={handleShiftOpen}
          onClose={() => setShiftModalMode(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
