'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SlidePanel from '@/components/ui/SlidePanel';
import { useLanguage } from '@/i18n/LanguageContext';
import { listOrders, deliverOrder } from '@/lib/ordersApi';
import type { OrderListItem } from '@/types/orders';
import { useToastStore } from '@/store/toastStore';
import { toastError } from '@/lib/toastError';
import {
  getRemittanceSummary,
  getCourierOrders,
  listRemittances,
  createRemittance,
  type CourierCodSummary,
  type OrderInCourierBoard,
  type CreateRemittancePayload,
} from '@/lib/remittanceApi';

type Tab = 'inTransit' | 'cod' | 'history';

const METHOD_LABELS: Record<string, string> = {
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  BANK: 'Bank Transfer',
  CASH: 'Cash',
};

const METHOD_COLORS: Record<string, string> = {
  BKASH: 'bg-pink-100 text-pink-700',
  NAGAD: 'bg-orange-100 text-orange-700',
  BANK: 'bg-blue-100 text-blue-700',
  CASH: 'bg-green-100 text-green-700',
};

export default function DeliveriesPage() {
  const [tab, setTab] = useState<Tab>('inTransit');
  const { t } = useLanguage();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3">
        <h1 className="text-base font-semibold text-gray-900">{t('deliveries.title')}</h1>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 flex shrink-0">
        <TabBtn active={tab === 'inTransit'} onClick={() => setTab('inTransit')} label={t('deliveries.tabInTransit')} />
        <TabBtn active={tab === 'cod'} onClick={() => setTab('cod')} label={t('deliveries.tabBoard')} />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} label={t('deliveries.tabHistory')} />
      </div>

      {tab === 'inTransit' ? <InTransitTab /> : tab === 'cod' ? <BoardTab /> : <HistoryTab />}
    </div>
  );
}

// ── In Transit Tab ────────────────────────────────────────────────────────────
// The actual "22 pending deliveries" board the dashboard tile links to — orders already handed
// to a courier (IN_TRANSIT) but not yet resolved. Separate from the COD tab below: that one is
// about money already collected by the courier for DELIVERED orders, a completely different
// population of orders from these still-in-transit ones.

function InTransitTab() {
  const { t } = useLanguage();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirmDeliverOrder, setConfirmDeliverOrder] = useState<OrderListItem | null>(null);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders', { fulfillmentStatus: 'IN_TRANSIT' }],
    queryFn: () => listOrders({ fulfillmentStatus: 'IN_TRANSIT' }),
    staleTime: 30_000,
  });

  const deliverMutation = useMutation({
    mutationFn: (id: string) => deliverOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard-home-summary'] });
      setConfirmDeliverOrder(null);
      useToastStore.getState().show(t('common.saved'));
    },
    onError: (err: unknown) => toastError(err, t('deliveries.failedMarkDelivered')),
  });

  // Returned orders go through the full Refund/Replace flow (item-level resolution, refund
  // method, etc.) which already lives on the order detail page — not duplicated inline here.
  const goToReturn = (id: string) => router.push(`/orders/${id}`);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <p className="text-sm text-red-400">{t('common.errorLoading')}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3 py-16">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">{t('deliveries.noInTransitOrders')}</p>
        <p className="text-xs text-gray-400">{t('deliveries.noInTransitOrdersHint')}</p>
      </div>
    );
  }

  // Group by courier — an IN_TRANSIT order should always have one, but a missing courier is
  // bucketed rather than silently dropped from the board.
  const groups = new Map<string, { courierName: string; orders: OrderListItem[] }>();
  for (const o of orders) {
    const key = o.courierId ?? '__none__';
    if (!groups.has(key)) groups.set(key, { courierName: o.courierName ?? t('deliveries.noCourierGroup'), orders: [] });
    groups.get(key)!.orders.push(o);
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {Array.from(groups.entries()).map(([key, group]) => (
        <CourierGroupSection
          key={key}
          courierName={group.courierName}
          orders={group.orders}
          onDeliver={setConfirmDeliverOrder}
          onReturn={goToReturn}
        />
      ))}

      {confirmDeliverOrder && (
        <ConfirmDeliverSheet
          order={confirmDeliverOrder}
          pending={deliverMutation.isPending}
          onConfirm={() => deliverMutation.mutate(confirmDeliverOrder.id)}
          onClose={() => setConfirmDeliverOrder(null)}
        />
      )}
    </div>
  );
}

function CourierGroupSection({
  courierName,
  orders,
  onDeliver,
  onReturn,
}: {
  courierName: string;
  orders: OrderListItem[];
  onDeliver: (order: OrderListItem) => void;
  onReturn: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-1 py-1.5"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {courierName} · {orders.length}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!collapsed && (
        <div className="space-y-2 mt-1">
          {orders.map((o) => (
            <InTransitOrderCard key={o.id} order={o} onDeliver={() => onDeliver(o)} onReturn={() => onReturn(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Whole days between HandedOverAt and now — null when an order has no handover timestamp yet
// (shouldn't happen for IN_TRANSIT, but the badge just doesn't render rather than show "NaN").
function daysSinceHandover(handedOverAt?: string): number | null {
  if (!handedOverAt) return null;
  const ms = Date.now() - new Date(handedOverAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function InTransitOrderCard({
  order,
  onDeliver,
  onReturn,
}: {
  order: OrderListItem;
  onDeliver: () => void;
  onReturn: () => void;
}) {
  const { t } = useLanguage();
  const days = daysSinceHandover(order.handedOverAt);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{order.orderNo}</p>
            {days !== null && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                days >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {t('deliveries.daysInTransit', { days })}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{order.customerName} · {order.customerPhone}</p>
          {order.trackingNo && (
            <p className="text-xs text-gray-400 font-mono mt-0.5">{order.trackingNo}</p>
          )}
        </div>
        <p className="text-sm font-bold text-gray-900 shrink-0">৳{order.totalAmount.toLocaleString('en-BD')}</p>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onReturn}
          className="flex-1 py-2 rounded-xl text-xs font-semibold border border-red-200 text-red-600 active:bg-red-50 transition-colors"
        >
          {t('deliveries.markReturned')}
        </button>
        <button
          type="button"
          onClick={onDeliver}
          className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white active:bg-emerald-700 transition-colors"
        >
          {t('deliveries.markDelivered')}
        </button>
      </div>
    </div>
  );
}

function ConfirmDeliverSheet({
  order,
  pending,
  onConfirm,
  onClose,
}: {
  order: OrderListItem;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <SlidePanel
      open
      onClose={onClose}
      title={t('deliveries.confirmDeliveredTitle', { orderNo: order.orderNo })}
      footer={
        <button
          onClick={onConfirm}
          disabled={pending}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 active:bg-emerald-700 transition-colors"
        >
          {pending ? t('common.saving') : t('deliveries.markDelivered')}
        </button>
      }
    >
      <div className="px-4 py-4">
        <p className="text-sm text-gray-600">{t('deliveries.confirmDeliveredBody')}</p>
      </div>
    </SlidePanel>
  );
}

// ── COD Reconciliation Tab ───────────────────────────────────────────────────────

function BoardTab() {
  const { t } = useLanguage();
  const [selectedCourier, setSelectedCourier] = useState<CourierCodSummary | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);

  const { data: summaries = [], isLoading, error } = useQuery({
    queryKey: ['remittance-summary'],
    queryFn: getRemittanceSummary,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <p className="text-sm text-red-400">{t('common.errorLoading')}</p>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3 py-16">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">{t('deliveries.noCourierActivity')}</p>
        <p className="text-xs text-gray-400">{t('deliveries.noCourierActivityHint')}</p>
      </div>
    );
  }

  const openRecord = (courier: CourierCodSummary) => {
    setSelectedCourier(courier);
    setRecordOpen(true);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Total summary banner */}
      <div className="mx-4 mt-4 mb-2 bg-indigo-600 rounded-2xl px-4 py-3 text-white">
        <p className="text-xs opacity-80">{t('deliveries.totalPending')}</p>
        <p className="text-2xl font-bold mt-0.5">
          ৳{summaries.reduce((s, c) => s + c.totalCodReceivable, 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
        <p className="text-xs opacity-70 mt-1">
          {summaries.reduce((s, c) => s + c.pendingOrderCount, 0)} {t('deliveries.pendingOrders')}
        </p>
      </div>

      <div className="px-4 pb-6 space-y-3 mt-3">
        {summaries.map((c) => (
          <CourierCard key={c.courierId} courier={c} onRecord={openRecord} />
        ))}
      </div>

      {selectedCourier && (
        <RecordRemittanceSlide
          open={recordOpen}
          courier={selectedCourier}
          onClose={() => setRecordOpen(false)}
        />
      )}
    </div>
  );
}

function CourierCard({
  courier,
  onRecord,
}: {
  courier: CourierCodSummary;
  onRecord: (c: CourierCodSummary) => void;
}) {
  const { t } = useLanguage();
  const hasPending = courier.pendingOrderCount > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{courier.courierName}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {courier.remittanceHistoryCount > 0
              ? `${courier.remittanceHistoryCount} ${t('deliveries.prevPayments')}`
              : t('deliveries.noPaymentYet')}
          </p>
        </div>
        {hasPending && (
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-gray-900">
              ৳{courier.totalCodReceivable.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-gray-400">
              {courier.pendingOrderCount} {t('deliveries.orders')}
            </p>
          </div>
        )}
      </div>

      {hasPending && (
        <div className="px-4 pb-3.5">
          <button
            onClick={() => onRecord(courier)}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold active:bg-indigo-700 transition-colors"
          >
            {t('deliveries.recordPayment')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Record Remittance Slide ────────────────────────────────────────────────────

function RecordRemittanceSlide({
  open,
  courier,
  onClose,
}: {
  open: boolean;
  courier: CourierCodSummary;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState('BKASH');
  const [reference, setReference] = useState('');
  const [remittedAt, setRemittedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['courier-orders', courier.courierId, 'PENDING'],
    queryFn: () => getCourierOrders(courier.courierId, 'PENDING'),
    enabled: open,
    staleTime: 10_000,
  });

  const allSelected = orders.length > 0 && selectedIds.size === orders.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map((o) => o.orderId)));
  };
  const toggle = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const selectedOrders = orders.filter((o) => selectedIds.has(o.orderId));
  const computedAmount = selectedOrders.reduce((s, o) => s + o.codAmount, 0);
  const amount = customAmount ? parseFloat(customAmount) : computedAmount;

  const mutation = useMutation({
    mutationFn: (payload: CreateRemittancePayload) => createRemittance(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['remittance-summary'] });
      qc.invalidateQueries({ queryKey: ['remittance-history'] });
      qc.invalidateQueries({ queryKey: ['courier-orders'] });
      onClose();
      setSelectedIds(new Set());
      setReference('');
      setNote('');
      setCustomAmount('');
    },
  });

  const handleSubmit = () => {
    if (selectedIds.size === 0 || !amount) return;
    mutation.mutate({
      courierId: courier.courierId,
      orderIds: Array.from(selectedIds),
      amount,
      method,
      reference: reference.trim() || undefined,
      remittedAt: new Date(remittedAt).toISOString(),
      note: note.trim() || undefined,
    });
  };

  const needsReference = method === 'BKASH' || method === 'NAGAD' || method === 'BANK';
  const canSubmit = selectedIds.size > 0 && amount > 0 && !mutation.isPending;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={`${t('deliveries.recordPayment')} — ${courier.courierName}`}
      footer={
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 active:bg-indigo-700 transition-colors"
        >
          {mutation.isPending ? t('common.saving') : `${t('deliveries.confirmReceived')} ৳${amount.toLocaleString('en-BD', { minimumFractionDigits: 0 })}`}
        </button>
      }
    >
      <div className="px-4 py-3 space-y-4">
        {/* Order selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('deliveries.selectOrders')}</p>
            {orders.length > 0 && (
              <button onClick={toggleAll} className="text-xs text-indigo-600 font-medium">
                {allSelected ? t('deliveries.deselectAll') : t('deliveries.selectAll')}
              </button>
            )}
          </div>

          {isLoading && <p className="text-sm text-gray-400 py-4 text-center">{t('common.loading')}</p>}

          {!isLoading && orders.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">{t('deliveries.noPendingOrders')}</p>
          )}

          <div className="space-y-2">
            {orders.map((order) => (
              <OrderSelectRow
                key={order.orderId}
                order={order}
                selected={selectedIds.has(order.orderId)}
                onToggle={() => toggle(order.orderId)}
              />
            ))}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="bg-indigo-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
            <p className="text-sm text-indigo-700 font-medium">
              {selectedIds.size} {t('deliveries.ordersSelected')}
            </p>
            <p className="text-sm font-bold text-indigo-900">৳{computedAmount.toLocaleString('en-BD')}</p>
          </div>
        )}

        {/* Payment date */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('deliveries.paymentDate')}
          </label>
          <input
            type="date"
            value={remittedAt}
            onChange={(e) => setRemittedAt(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {/* Method */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('deliveries.paymentMethod')}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['BKASH', 'NAGAD', 'BANK', 'CASH'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  method === m
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Reference / TrxID */}
        {needsReference && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              {method === 'BANK' ? t('deliveries.bankReference') : t('deliveries.transactionId')}
            </label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder={method === 'BANK' ? 'TXN-XXXXXXXX' : '01XXXXXXXXX → TrxID'}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        )}

        {/* Override amount */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('deliveries.amountReceived')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">৳</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder={computedAmount.toString()}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
          </div>
          {!customAmount && selectedIds.size > 0 && (
            <p className="text-xs text-gray-400 mt-1">{t('deliveries.autoCalculated')}</p>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('common.note')} ({t('common.optional')})
          </label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
            rows={2}
            placeholder={t('deliveries.notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {mutation.isError && (
          <p className="text-xs text-red-500 text-center">
            {(mutation.error as Error)?.message ?? t('common.errorGeneric')}
          </p>
        )}
      </div>
    </SlidePanel>
  );
}

function OrderSelectRow({
  order,
  selected,
  onToggle,
}: {
  order: OrderInCourierBoard;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
        selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 bg-gray-50'
      }`}
    >
      <div className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${
        selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'
      }`}>
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-900">{order.orderNo}</p>
          {order.trackingNo && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
              {order.trackingNo}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{order.customerName} · {order.customerPhone}</p>
        {order.deliveredAt && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {new Date(order.deliveredAt).toLocaleDateString('en-BD', { day: '2-digit', month: 'short' })}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">৳{order.codAmount.toLocaleString('en-BD')}</p>
        <p className="text-[10px] text-gray-400">{order.fulfillmentStatus}</p>
      </div>
    </button>
  );
}

// ── History Tab ────────────────────────────────────────────────────────────────

function HistoryTab() {
  const { t } = useLanguage();

  const { data: remittances = [], isLoading } = useQuery({
    queryKey: ['remittance-history'],
    queryFn: listRemittances,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (remittances.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-2 py-16">
        <p className="text-sm font-medium text-gray-600">{t('deliveries.noHistoryYet')}</p>
        <p className="text-xs text-gray-400">{t('deliveries.noHistoryHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {remittances.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{r.remittanceNo}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${METHOD_COLORS[r.method] ?? 'bg-gray-100 text-gray-600'}`}>
                  {METHOD_LABELS[r.method] ?? r.method}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{r.courierName}</p>
              {r.reference && (
                <p className="text-xs text-gray-400 font-mono mt-0.5">{r.reference}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                {new Date(r.remittedAt).toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' })}
                {' · '}{r.orderCount} {t('deliveries.orders')}
                {' · '}{r.recordedByName}
              </p>
            </div>
            <p className="text-lg font-bold text-indigo-700 shrink-0">
              ৳{r.amount.toLocaleString('en-BD', { minimumFractionDigits: 0 })}
            </p>
          </div>
          {r.note && (
            <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50">{r.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400'
      }`}
    >
      {label}
    </button>
  );
}
