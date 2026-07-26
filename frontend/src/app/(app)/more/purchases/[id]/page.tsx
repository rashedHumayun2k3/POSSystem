'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTrip,
  addItem,
  updateItem,
  removeItem,
  addCost,
  removeCost,
  submitTrip,
  approveTrip,
  cancelTrip,
  createReceiveSession,
  approveSession,
  rejectSession,
  closeTrip,
  previewSession,
  updateTripHeader,
} from '@/lib/purchasesApi';
import type {
  PurchaseItemDto,
  CostType,
  TransportMode,
  ForceCloseRequired,
  PurchaseReceiveSessionDto,
  SessionPreview,
} from '@/types/purchases';
import type { ProductSearchResult } from '@/types/catalog';
import type { SupplierDto } from '@/types/supplier';
import { useAuthStore } from '@/store/authStore';
import SupplierPicker from '@/components/purchases/SupplierPicker';
import ProductPicker from '@/components/purchases/ProductPicker';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToastStore } from '@/store/toastStore';

// ── Constants ──────────────────────────────────────────────────────────────

const SESSION_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-800',
  'bg-purple-50 border-purple-200 text-purple-800',
  'bg-emerald-50 border-emerald-200 text-emerald-800',
  'bg-orange-50 border-orange-200 text-orange-800',
  'bg-cyan-50 border-cyan-200 text-cyan-800',
  'bg-pink-50 border-pink-200 text-pink-800',
  'bg-amber-50 border-amber-200 text-amber-800',
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  RECEIVING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'items' | 'costs' | 'receive';

interface SessionItemEntry {
  qtyUsable: string;
  qtyDamaged: string;
  packets: string;
  itemsPerPacket: string;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string } | string }; message?: string };
  const data = err.response?.data;
  if (typeof data === 'string') return data.split(/\r?\n/)[0] || fallback;
  if (data && typeof data === 'object') return data.message ?? fallback;
  return err.message ?? fallback;
}

const formatQty = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// ── Page ───────────────────────────────────────────────────────────────────

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const isOwner = useAuthStore((s) => s.isOwner());
  const { t } = useLanguage();

  const [tab, setTab] = useState<Tab>('items');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseItemDto | null>(null);

  // Trip header inline editing
  const [headerDelivery, setHeaderDelivery] = useState<string>('');
  const [headerPoRef, setHeaderPoRef] = useState<string>('');
  const [headerInitialized, setHeaderInitialized] = useState(false);

  // Picker visibility
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);

  // Session form
  const [showAddSession, setShowAddSession] = useState(false);
  const [sessionFormMeta, setSessionFormMeta] = useState({
    receivedAt: new Date().toISOString().slice(0, 16),
    transportMode: 'TRUCK' as TransportMode,
    vehicleOrTrackingNo: '',
    note: '',
  });
  const [sessionItemEntries, setSessionItemEntries] = useState<Record<string, SessionItemEntry>>({});

  // Session review
  const [previewData, setPreviewData] = useState<{ sessionId: string; data: SessionPreview } | null>(null);
  const [rejectingSessionId, setRejectingSessionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Close trip
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [forceCloseRequired, setForceCloseRequired] = useState<ForceCloseRequired | null>(null);
  const [forceCloseReason, setForceCloseReason] = useState('');

  const { data: trip, isLoading } = useQuery({
    queryKey: ['purchase-trip', id],
    queryFn: () => getTrip(id),
    select: (data) => {
      if (!headerInitialized) {
        setHeaderDelivery(data.expectedDeliveryDate ? data.expectedDeliveryDate.slice(0, 10) : '');
        setHeaderPoRef(data.supplierPoRef ?? '');
        setHeaderInitialized(true);
      }
      return data;
    },
  });

  const headerMutation = useMutation({
    mutationFn: () =>
      updateTripHeader(id, {
        expectedDeliveryDate: headerDelivery || null,
        supplierPoRef: headerPoRef || null,
      }),
    onSuccess: (updated) => qc.setQueryData(['purchase-trip', id], updated),
  });

  const saveHeader = () => headerMutation.mutate();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['purchase-trip', id] });
  const invalidateList = () => qc.invalidateQueries({ queryKey: ['purchase-trips'] });

  // ── Item form state ──────────────────────────────────────────────────────

  const [selectedVariant, setSelectedVariant] = useState<{
    variantId: string;
    productName: string;
    variantSku: string;
    unitCode: string;
  } | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDto | null>(null);

  const [itemForm, setItemForm] = useState({
    qtyBought: '',
    totalCost: '',
  });
  // "আমি বাকি রাখতে চাই" — unchecked by default (assume fully paid, the common case). Paid Now
  // is always derived, never typed directly: totalCost when unchecked, totalCost − due when checked.
  const [wantsDue, setWantsDue] = useState(false);
  const [dueInput, setDueInput] = useState('');

  const totalCostNumber = Number(itemForm.totalCost);
  const dueNumber = wantsDue ? Number(dueInput || '0') : 0;
  const paidNowComputed = Number.isFinite(totalCostNumber)
    ? Math.max(totalCostNumber - (Number.isFinite(dueNumber) ? dueNumber : 0), 0)
    : 0;

  const dueError = (() => {
    if (!wantsDue || !dueInput || !itemForm.totalCost) return '';
    if (!Number.isFinite(dueNumber) || dueNumber < 0) return t('purchases.dueInvalid');
    if (Number.isFinite(totalCostNumber) && dueNumber > totalCostNumber)
      return t('purchases.dueExceedsTotal', { due: dueNumber.toLocaleString(), total: totalCostNumber.toLocaleString() });
    return '';
  })();

  const addItemMutation = useMutation({
    mutationFn: () =>
      addItem(id, {
        variantId: selectedVariant!.variantId,
        qtyBought: parseFloat(itemForm.qtyBought),
        totalCost: parseFloat(itemForm.totalCost),
        supplierId: selectedSupplier?.id || undefined,
        paidNow: paidNowComputed,
        dueAmount: dueNumber,
      }),
    onSuccess: () => { invalidate(); resetItemForm(); setShowAddItem(false); },
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const updateItemMutation = useMutation({
    mutationFn: () =>
      updateItem(id, editingItem!.id, {
        qtyBought: parseFloat(itemForm.qtyBought),
        totalCost: parseFloat(itemForm.totalCost),
        supplierId: selectedSupplier?.id || undefined,
        paidNow: paidNowComputed,
        dueAmount: dueNumber,
      }),
    onSuccess: () => { invalidate(); resetItemForm(); setEditingItem(null); },
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => removeItem(id, itemId),
    onSuccess: () => invalidate(),
  });

  const resetItemForm = () => {
    setItemForm({ qtyBought: '', totalCost: '' });
    setWantsDue(false);
    setDueInput('');
    setSelectedVariant(null);
    setSelectedSupplier(null);
  };

  const openEditItem = (item: PurchaseItemDto) => {
    setEditingItem(item);
    setSelectedVariant({ variantId: item.variantId, productName: item.productName, variantSku: item.variantSku, unitCode: item.unitCode || 'pcs' });
    setSelectedSupplier(
      item.supplierId
        ? { id: item.supplierId, name: item.supplierName ?? '', address: item.supplierAddress, phone: null, notes: null, usageCount: 0, lastUsedAt: null }
        : null
    );
    setItemForm({ qtyBought: String(item.qtyBought), totalCost: String(item.totalCost) });
    setWantsDue(item.dueAmount > 0);
    setDueInput(item.dueAmount > 0 ? String(item.dueAmount) : '');
  };

  // ── Cost form state ──────────────────────────────────────────────────────

  const [costForm, setCostForm] = useState({ costType: 'TRANSPORT' as CostType, amount: '', note: '', paidBy: '' });

  const addCostMutation = useMutation({
    mutationFn: () =>
      addCost(id, { costType: costForm.costType, amount: parseFloat(costForm.amount), note: costForm.note || undefined, paidBy: costForm.paidBy || undefined }),
    onSuccess: () => { invalidate(); setCostForm({ costType: 'TRANSPORT', amount: '', note: '', paidBy: '' }); setShowAddCost(false); },
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const removeCostMutation = useMutation({
    mutationFn: (costId: string) => removeCost(id, costId),
    onSuccess: () => invalidate(),
  });

  // ── Lifecycle mutations ──────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: () => submitTrip(id),
    onSuccess: () => invalidate(),
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTrip(id),
    onSuccess: () => invalidate(),
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTrip(id),
    onSuccess: () => { invalidate(); router.back(); },
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  // ── Session mutations ────────────────────────────────────────────────────

  const createSessionMutation = useMutation({
    mutationFn: () => {
      const items = (trip?.items ?? [])
        .filter((item) => {
          const remaining = item.qtyBought - item.qtyUsable - item.qtyDamaged;
          const entry = sessionItemEntries[item.id];
          if (!entry) return false;
          const u = Number(entry.qtyUsable || '0');
          const d = Number(entry.qtyDamaged || '0');
          return u + d > 0 && remaining > 0;
        })
        .map((item) => {
          const entry = sessionItemEntries[item.id];
          const packets = Number(entry?.packets || '0');
          const itemsPerPacket = Number(entry?.itemsPerPacket || '0');
          const lotData: Record<string, number> = {};
          if (packets > 0) lotData.packets = packets;
          if (itemsPerPacket > 0) lotData.itemsPerPacket = itemsPerPacket;
          return {
            purchaseItemId: item.id,
            qtyUsable: Number(entry?.qtyUsable || '0'),
            qtyDamaged: Number(entry?.qtyDamaged || '0'),
            perLotValuesJson: JSON.stringify(lotData),
          };
        });

      if (items.length === 0) throw new Error(t('purchases.enterQty'));

      return createReceiveSession(id, {
        receivedAt: new Date(sessionFormMeta.receivedAt).toISOString(),
        transportMode: sessionFormMeta.transportMode,
        vehicleOrTrackingNo: sessionFormMeta.vehicleOrTrackingNo || undefined,
        note: sessionFormMeta.note || undefined,
        items,
      });
    },
    onSuccess: () => {
      invalidate();
      setShowAddSession(false);
      setSessionItemEntries({});
      setSessionFormMeta({ receivedAt: new Date().toISOString().slice(0, 16), transportMode: 'TRUCK', vehicleOrTrackingNo: '', note: '' });
    },
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const previewSessionMutation = useMutation({
    mutationFn: (sessionId: string) => previewSession(id, sessionId),
    onSuccess: (data, sessionId) => setPreviewData({ sessionId, data }),
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const approveSessionMutation = useMutation({
    mutationFn: (sessionId: string) => approveSession(id, sessionId),
    onSuccess: () => { invalidate(); invalidateList(); setPreviewData(null); },
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const rejectSessionMutation = useMutation({
    mutationFn: (sessionId: string) => rejectSession(id, sessionId, rejectReason || undefined),
    onSuccess: () => { invalidate(); setRejectingSessionId(null); setRejectReason(''); },
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  const closeTripMutation = useMutation({
    mutationFn: (reason?: string) => closeTrip(id, reason),
    onSuccess: (data) => {
      if ('requiresForceClose' in data) {
        setForceCloseRequired(data);
        return;
      }
      invalidate();
      invalidateList();
      setShowCloseConfirm(false);
      setForceCloseRequired(null);
      setForceCloseReason('');
      if (data.status === 'COMPLETED') router.replace('/more/purchases');
    },
    onError: (err) => useToastStore.getState().show(getApiErrorMessage(err, t('common.error')), 'error'),
  });

  // ── Translated lookup maps (built inside component to access t()) ──────────

  const COST_TYPE_LABELS: Record<CostType, string> = {
    TRANSPORT:    t('purchases.costTransport'),
    LABOR:        t('purchases.costLabor'),
    CUSTOMS:      t('purchases.costCustoms'),
    SHIPPING_INTL: t('purchases.costShippingIntl'),
    CURRENCY_LOSS: t('purchases.costCurrencyLoss'),
    AGENT_FEE:    t('purchases.costAgentFee'),
    PAYMENT_FEE:  t('purchases.costPaymentFee'),
    OTHER:        t('purchases.costOther'),
  };

  const COST_TYPE_OPTIONS: { value: CostType; label: string }[] = [
    { value: 'TRANSPORT',    label: COST_TYPE_LABELS.TRANSPORT },
    { value: 'LABOR',        label: COST_TYPE_LABELS.LABOR },
    { value: 'CUSTOMS',      label: COST_TYPE_LABELS.CUSTOMS },
    { value: 'SHIPPING_INTL', label: COST_TYPE_LABELS.SHIPPING_INTL },
    { value: 'CURRENCY_LOSS', label: COST_TYPE_LABELS.CURRENCY_LOSS },
    { value: 'AGENT_FEE',    label: COST_TYPE_LABELS.AGENT_FEE },
    { value: 'PAYMENT_FEE',  label: COST_TYPE_LABELS.PAYMENT_FEE },
    { value: 'OTHER',        label: COST_TYPE_LABELS.OTHER },
  ];

  const TRANSPORT_MODE_OPTIONS: { value: TransportMode; label: string }[] = [
    { value: 'TRUCK',   label: t('purchases.transportTruck') },
    { value: 'BUS',     label: t('purchases.transportBus') },
    { value: 'AIR',     label: t('purchases.transportAir') },
    { value: 'COURIER', label: t('purchases.transportCourier') },
    { value: 'BOAT',    label: t('purchases.transportBoat') },
    { value: 'WALK_IN', label: t('purchases.transportWalkIn') },
    { value: 'OTHER',   label: t('purchases.transportOther') },
  ];

  const STATUS_LABELS: Record<string, string> = {
    DRAFT:            t('purchases.statusDraft'),
    PENDING_APPROVAL: t('purchases.statusPending'),
    RECEIVING:        t('purchases.statusReceiving'),
    COMPLETED:        t('purchases.statusCompleted'),
    CANCELLED:        t('purchases.statusCancelled'),
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const totalItemCost = trip?.items.reduce((s, i) => s + i.totalCost, 0) ?? 0;
  const totalSharedCost = trip?.costs.filter((c) => !c.isPostCompletion).reduce((s, c) => s + c.amount, 0) ?? 0;
  const totalLateCost = trip?.costs.filter((c) => c.isPostCompletion).reduce((s, c) => s + c.amount, 0) ?? 0;

  if (isLoading || !trip) {
    return (
      <div className="px-4 py-8 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const isDraft = trip.status === 'DRAFT';
  const isReceiving = trip.status === 'RECEIVING' || trip.status === 'DRAFT';
  const isCompleted = trip.status === 'COMPLETED';

  const qtyBoughtNumber = Number(itemForm.qtyBought);
  const isSavingItem = addItemMutation.isPending || updateItemMutation.isPending;
  const hasSelectedVariant = Boolean(editingItem || selectedVariant);
  const hasValidQty = Number.isFinite(qtyBoughtNumber) && qtyBoughtNumber > 0;
  const hasValidTotalCost = Number.isFinite(totalCostNumber) && totalCostNumber > 0;
  const canSaveItem = hasSelectedVariant && hasValidQty && hasValidTotalCost && !dueError && !isSavingItem;

  const itemsWithRemaining = (trip.items ?? []).filter(
    (i) => i.qtyBought - i.qtyUsable - i.qtyDamaged > 0
  );

  const pendingSessions = (trip.sessions ?? []).filter((s) => s.status === 'PENDING_APPROVAL');

  return (
    <div className="pb-32 overflow-x-hidden">
      {/* Slide-in pickers */}
      <ProductPicker
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={(r: ProductSearchResult) => {
          setSelectedVariant({ variantId: r.variantId, productName: r.productName, variantSku: r.variantSku, unitCode: r.unitCode || 'pcs' });
          setShowProductPicker(false);
        }}
      />
      <SupplierPicker
        open={showSupplierPicker}
        onClose={() => setShowSupplierPicker(false)}
        onSelect={(s) => setSelectedSupplier(s)}
        selectedId={selectedSupplier?.id}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-900">{trip.tripNo}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[trip.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[trip.status] ?? trip.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">{trip.sourceType.replace('_', ' ')}</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-indigo-50 px-4 py-3 flex gap-5 text-sm flex-wrap">
        <div>
          <p className="text-[10px] text-indigo-400">{t('purchases.itemsCost')}</p>
          <p className="font-semibold text-indigo-800 text-sm">৳{totalItemCost.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-indigo-400">{t('purchases.sharedCosts')}</p>
          <p className="font-semibold text-indigo-800 text-sm">৳{totalSharedCost.toLocaleString()}</p>
        </div>
        {totalLateCost > 0 && (
          <div>
            <p className="text-[10px] text-amber-500">{t('purchases.lateCosts')}</p>
            <p className="font-semibold text-amber-700 text-sm">৳{totalLateCost.toLocaleString()}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] text-indigo-400">
            {t('purchases.total')} ({t('purchases.itemsCost')} + {t('purchases.sharedCosts')}
            {totalLateCost > 0 ? ` + ${t('purchases.lateCosts')}` : ''})
          </p>
          <p className="font-bold text-indigo-900 text-sm">৳{(totalItemCost + totalSharedCost + totalLateCost).toLocaleString()}</p>
        </div>
      </div>

      {/* Order info row */}
      {(() => {
        const editable = trip.status === 'DRAFT' || trip.status === 'RECEIVING';
        const showDelivery = editable || Boolean(trip.expectedDeliveryDate);
        const showPoRef = editable || Boolean(trip.supplierPoRef);
        if (!showDelivery && !showPoRef) return null;
        return (
          <div className="px-4 py-2.5 border-b border-gray-100 flex gap-3">
            {showDelivery && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 mb-0.5">{t('purchases.expectedDelivery')}</p>
                {editable ? (
                  <input
                    type="date"
                    value={headerDelivery}
                    onChange={(e) => setHeaderDelivery(e.target.value)}
                    onBlur={saveHeader}
                    className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 bg-white"
                  />
                ) : (
                  <p className="text-xs text-gray-700">
                    {new Date(trip.expectedDeliveryDate!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            )}
            {showPoRef && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 mb-0.5">{t('purchases.supplierPoRef')}</p>
                {editable ? (
                  <input
                    type="text"
                    value={headerPoRef}
                    onChange={(e) => setHeaderPoRef(e.target.value)}
                    onBlur={saveHeader}
                    placeholder="e.g. ALI-20260614"
                    className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 bg-white"
                  />
                ) : (
                  <p className="text-xs text-gray-700">{trip.supplierPoRef}</p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tabs */}
      {(() => {
        const TAB_META: Record<Tab, { label: string; text: string; border: string; dot: string }> = {
          items:   { label: t('purchases.tabItems'),   text: 'text-blue-600',    border: 'border-blue-500',    dot: 'bg-blue-500'    },
          costs:   { label: t('purchases.tabCosts'),   text: 'text-amber-600',   border: 'border-amber-500',   dot: 'bg-amber-500'   },
          receive: { label: t('purchases.tabReceive'), text: 'text-emerald-600', border: 'border-emerald-500', dot: 'bg-emerald-500' },
        };
        return (
          <div className="flex border-b border-indigo-200 bg-indigo-100">
            {(['items', 'costs', 'receive'] as Tab[]).map((t2) => {
              const m = TAB_META[t2];
              const active = tab === t2;
              return (
                <button
                  key={t2}
                  onClick={() => setTab(t2)}
                  className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                    active ? `${m.text} ${m.border}` : 'text-gray-400 border-transparent'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold transition-colors ${
                    active ? `${m.dot} text-white` : 'bg-gray-100 text-gray-500'
                  }`}>
                    {t2 === 'items' ? '📦' : t2 === 'costs' ? '💰' : '🚚'}
                  </span>
                  {m.label}
                  {t2 === 'receive' && pendingSessions.length > 0 && (
                    <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingSessions.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── Items tab ─────────────────────────────────────────────────── */}
      {tab === 'items' && (
        <div className="px-4 pt-3 space-y-2">
          {isDraft && (
            <>
              {(showAddItem || editingItem) ? (
                <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-indigo-800">{editingItem ? t('purchases.editItem') : t('purchases.addItem')}</p>

                  {editingItem ? (
                    <p className="text-sm text-gray-700 font-medium">
                      {editingItem.productName}{' '}
                      <span className="text-xs text-gray-400">({editingItem.variantSku})</span>
                    </p>
                  ) : (
                    <div>
                      {selectedVariant ? (
                        <div className="flex items-center justify-between bg-white border border-indigo-200 rounded-xl px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{selectedVariant.productName}</p>
                            <p className="text-xs text-gray-400">{selectedVariant.variantSku}</p>
                          </div>
                          <button onClick={() => setShowProductPicker(true)} className="text-xs text-indigo-600 font-medium shrink-0 ml-2">{t('common.change')}</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowProductPicker(true)}
                          className="w-full flex items-center justify-between bg-white border border-dashed border-indigo-300 rounded-xl px-3 py-2.5 text-sm text-indigo-600 font-medium"
                        >
                          <span>{t('purchases.searchProduct')}</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('purchases.qtyBought')} <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input type="number" required className="w-full border border-indigo-200 rounded-lg px-3 py-2 pr-12 text-sm bg-white" placeholder="100"
                          value={itemForm.qtyBought} onChange={(e) => setItemForm((f) => ({ ...f, qtyBought: e.target.value }))} />
                        {selectedVariant?.unitCode && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                            {selectedVariant.unitCode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('purchases.totalCost')} <span className="text-red-500">*</span></label>
                      <input type="number" required className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder="10000"
                        value={itemForm.totalCost} onChange={(e) => setItemForm((f) => ({ ...f, totalCost: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('purchases.supplier')}</label>
                    {selectedSupplier ? (
                      <div className="flex items-center justify-between bg-white border border-indigo-200 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{selectedSupplier.name}</p>
                          {selectedSupplier.address && <p className="text-xs text-gray-400 truncate">{selectedSupplier.address}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0 ml-2">
                          <button onClick={() => setShowSupplierPicker(true)} className="text-xs text-indigo-600 font-medium">{t('common.change')}</button>
                          <button onClick={() => setSelectedSupplier(null)} className="text-xs text-gray-400">✕</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowSupplierPicker(true)}
                        className="w-full flex items-center justify-between bg-white border border-dashed border-indigo-300 rounded-xl px-3 py-2.5 text-sm text-indigo-500 font-medium">
                        <span>{t('purchases.chooseSupplier')}</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wantsDue}
                      onChange={(e) => { setWantsDue(e.target.checked); if (!e.target.checked) setDueInput(''); }}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">{t('purchases.wantsDueLabel')}</span>
                  </label>

                  <div className={wantsDue ? 'grid grid-cols-2 gap-2' : ''}>
                    {wantsDue && (
                      <div>
                        <label className={`text-xs mb-1 block ${dueError ? 'text-red-500' : 'text-gray-500'}`}>{t('purchases.due')}</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={dueInput}
                          onChange={(e) => setDueInput(e.target.value)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${
                            dueError ? 'border-red-400 focus:outline-red-400' : 'border-indigo-200'
                          }`}
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('purchases.paidNow')}</label>
                      <input type="number" className="w-full border border-indigo-100 rounded-lg px-3 py-2 text-sm bg-indigo-50 text-gray-600"
                        value={paidNowComputed} readOnly />
                      <p className="text-[11px] text-gray-400 mt-1">
                        {wantsDue ? t('purchases.dueHint') : t('purchases.fullyPaidHint')}
                      </p>
                    </div>
                  </div>
                  {dueError && (
                    <p className="text-xs text-red-500 -mt-1">{dueError}</p>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => { if (canSaveItem) { if (editingItem) updateItemMutation.mutate(); else addItemMutation.mutate(); } }}
                      disabled={!canSaveItem} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {isSavingItem ? t('common.saving') : editingItem ? t('common.update') : t('common.add')}
                    </button>
                    <button onClick={() => { resetItemForm(); setShowAddItem(false); setEditingItem(null); }}
                      className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-200">{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddItem(true)}
                  className="w-full border-2 border-dashed border-indigo-200 rounded-xl py-3 text-sm text-indigo-600 font-medium">
                  {t('purchases.addProduct')}
                </button>
              )}
            </>
          )}

          {trip.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{t('purchases.noItems')}</p>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider pt-2 pb-1">
                {trip.items.length} {trip.items.length !== 1 ? t('purchases.items') : t('purchases.item')}
              </p>
              {trip.items.map((item) => {
                const received = item.qtyUsable + item.qtyDamaged;
                const remaining = item.qtyBought - received;
                const notReceivedYet = remaining > 0;
                return (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-3 ${notReceivedYet ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-400">{item.variantSku}</p>
                        {item.supplierName && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.supplierName}
                            {item.supplierAddress && <span className="text-gray-300"> · {item.supplierAddress}</span>}
                          </p>
                        )}
                      </div>
                      {isDraft && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditItem(item)} className="text-xs text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg">{t('common.edit')}</button>
                          <button onClick={() => removeItemMutation.mutate(item.id)} className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded-lg">✕</button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span>{t('purchases.bought')}: <strong>{formatQty(item.qtyBought)}</strong></span>
                      {received > 0 && <span>{t('purchases.received')}: <strong className="text-green-700">{formatQty(item.qtyUsable)}</strong></span>}
                      {item.qtyDamaged > 0 && <span>{t('purchases.damaged')}: <strong className="text-red-600">{formatQty(item.qtyDamaged)}</strong></span>}
                      {remaining > 0 && <span className="text-amber-600">{t('purchases.remaining')}: <strong>{formatQty(remaining)}</strong></span>}
                      <span>Cost: <strong>৳{item.totalCost.toLocaleString()}</strong></span>
                      {item.dueAmount > 0 && <span className="text-amber-600">Due: ৳{item.dueAmount}</span>}
                    </div>
                    {notReceivedYet && (
                      <p className="text-xs text-red-600 font-medium mt-2">{t('purchases.notReceivedWarning')}</p>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── Costs tab ──────────────────────────────────────────────────── */}
      {tab === 'costs' && (
        <div className="px-4 pt-3 space-y-2">
          {(isDraft || isReceiving || isCompleted) && (
            <>
              {showAddCost ? (
                <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-indigo-800">{isCompleted ? t('purchases.addLateCostTitle') : t('purchases.addCostTitle')}</p>
                  {isCompleted && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      {t('purchases.lateCostWarning')}
                    </p>
                  )}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {COST_TYPE_OPTIONS.map((c) => (
                      <button key={c.value} type="button"
                        onClick={() => setCostForm((f) => ({ ...f, costType: c.value }))}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          costForm.costType === c.value
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-indigo-200 text-indigo-700'
                        }`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <input type="number" className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('purchases.amount')}
                    value={costForm.amount} onChange={(e) => setCostForm((f) => ({ ...f, amount: e.target.value }))} />
                  <input className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('purchases.note')}
                    value={costForm.note} onChange={(e) => setCostForm((f) => ({ ...f, note: e.target.value }))} />
                  <input className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('purchases.paidBy')}
                    value={costForm.paidBy} onChange={(e) => setCostForm((f) => ({ ...f, paidBy: e.target.value }))} />
                  <div className="flex gap-2">
                    <button onClick={() => addCostMutation.mutate()} disabled={!costForm.amount || addCostMutation.isPending}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {addCostMutation.isPending ? t('common.adding') : t('purchases.addCostBtn')}
                    </button>
                    <button onClick={() => { setCostForm({ costType: 'TRANSPORT', amount: '', note: '', paidBy: '' }); setShowAddCost(false); }}
                      className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-200">{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddCost(true)}
                  className={`w-full border-2 border-dashed rounded-xl py-3 text-sm font-medium ${isCompleted ? 'border-amber-200 text-amber-600' : 'border-indigo-200 text-indigo-600'}`}>
                  {isCompleted ? t('purchases.addLateCost') : t('purchases.addSharedCost')}
                </button>
              )}
            </>
          )}

          {trip.costs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{t('purchases.noCosts')}</p>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider pt-2 pb-1">
                {trip.costs.length} cost{trip.costs.length !== 1 ? 's' : ''}
              </p>
              {trip.costs.map((cost) => (
                <div key={cost.id} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{COST_TYPE_LABELS[cost.costType as CostType] ?? cost.costType}</p>
                      {cost.isPostCompletion && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full shrink-0">{t('purchases.late')}</span>
                      )}
                    </div>
                    {cost.note && <p className="text-xs text-gray-400 truncate">{cost.note}</p>}
                    {cost.paidBy && <p className="text-xs text-gray-400">{t('purchases.paidByLabel')}: {cost.paidBy}</p>}
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${cost.isPostCompletion ? 'text-amber-700' : 'text-gray-900'}`}>
                    ৳{cost.amount.toLocaleString()}
                  </p>
                  {(isDraft || (isCompleted && cost.isPostCompletion)) && (
                    <button onClick={() => removeCostMutation.mutate(cost.id)} className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded-lg shrink-0">✕</button>
                  )}
                </div>
              ))}
              <div className="bg-indigo-50 rounded-xl px-4 py-3 mt-1 space-y-1">
                {totalSharedCost > 0 && (
                  <div className="flex justify-between text-xs text-indigo-600">
                    <span>{t('purchases.sharedCosts')}</span>
                    <span>৳{totalSharedCost.toLocaleString()}</span>
                  </div>
                )}
                {totalLateCost > 0 && (
                  <div className="flex justify-between text-xs text-amber-600">
                    <span>{t('purchases.lateCosts')}</span>
                    <span>৳{totalLateCost.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold text-indigo-800 pt-1 border-t border-indigo-100">
                  <span>{t('purchases.total')}</span>
                  <span>৳{(totalSharedCost + totalLateCost).toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Receive tab ────────────────────────────────────────────────── */}
      {tab === 'receive' && (
        <div className="px-4 pt-3 space-y-3">

          {/* Item summary table */}
          {trip.items.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl mb-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('purchases.itemSummary')}</p>
              </div>
              <div className="space-y-2">
                {trip.items.map((item) => {
                  const remaining = item.qtyBought - item.qtyUsable - item.qtyDamaged;
                  const pendingQty = (trip.sessions ?? [])
                    .filter((s) => s.status === 'PENDING_APPROVAL')
                    .flatMap((s) => s.items)
                    .filter((si) => si.purchaseItemId === item.id)
                    .reduce((sum, si) => sum + si.qtyUsable + si.qtyDamaged, 0);

                  return (
                    <div
                      key={item.id}
                      className={`px-3 py-2 border rounded-xl ${
                        remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-800 truncate">{item.productName} <span className="text-gray-400">({item.variantSku})</span></p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                        <span className="text-gray-500">{t('purchases.ordered')}: <strong>{formatQty(item.qtyBought)}</strong></span>
                        {item.qtyUsable > 0 && <span className="text-green-700">{t('purchases.approved')}: <strong>{formatQty(item.qtyUsable)}</strong></span>}
                        {item.qtyDamaged > 0 && <span className="text-red-600">{t('purchases.damaged')}: <strong>{formatQty(item.qtyDamaged)}</strong></span>}
                        {pendingQty > 0 && <span className="text-purple-600">{t('purchases.pending')}: <strong>{formatQty(pendingQty)}</strong></span>}
                        {remaining > 0 && <span className="text-amber-600">{t('purchases.remaining')}: <strong>{formatQty(remaining)}</strong></span>}
                        {remaining === 0 && <span className="text-green-600 font-semibold">{t('purchases.complete')}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed notice */}
          {isCompleted && (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-green-800">{t('purchases.tripCompleted')}</p>
              {trip.forceCloseReason && (
                <p className="text-xs text-amber-700 mt-1">{t('purchases.forceCloseClosedWith')}: {trip.forceCloseReason}</p>
              )}
            </div>
          )}

          {/* Session timeline */}
          {(trip.sessions ?? []).length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider pb-1">{t('purchases.receiveSessions')}</p>
              {(trip.sessions ?? []).map((session, idx) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  colorClass={SESSION_COLORS[idx % SESSION_COLORS.length]}
                  items={trip.items}
                  isOwner={isOwner}
                  isPreviewLoading={previewSessionMutation.isPending}
                  currentPreview={previewData?.sessionId === session.id ? previewData.data : null}
                  onPreview={() => previewSessionMutation.mutate(session.id)}
                  onApprove={() => {
                    if (!confirm(t('purchases.approveSessionConfirm', {
                      sessionNo: session.sessionNo,
                      qty: session.items.reduce((s, i) => s + i.qtyUsable, 0),
                    }))) return;
                    approveSessionMutation.mutate(session.id);
                  }}
                  onReject={() => { setRejectingSessionId(session.id); setRejectReason(''); }}
                  isApproving={approveSessionMutation.isPending}
                  t={t}
                  transportModeOptions={TRANSPORT_MODE_OPTIONS}
                />
              ))}
            </div>
          )}

          {/* Reject dialog */}
          {rejectingSessionId && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">{t('purchases.rejectSession')}</p>
              <textarea
                rows={2}
                placeholder={t('purchases.rejectReason')}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => { setRejectingSessionId(null); setRejectReason(''); }}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm">{t('common.cancel')}</button>
                <button onClick={() => rejectSessionMutation.mutate(rejectingSessionId)} disabled={rejectSessionMutation.isPending}
                  className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {rejectSessionMutation.isPending ? t('purchases.rejecting') : t('common.reject')}
                </button>
              </div>
            </div>
          )}

          {/* Add session form */}
          {isReceiving && (
            <>
              {showAddSession ? (
                <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-indigo-800">{t('purchases.newReceiveSession')}</p>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('purchases.receivedAt')}</label>
                    <input
                      type="datetime-local"
                      className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                      value={sessionFormMeta.receivedAt}
                      onChange={(e) => setSessionFormMeta((f) => ({ ...f, receivedAt: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('purchases.transportMode')}</label>
                    <select
                      className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                      value={sessionFormMeta.transportMode}
                      onChange={(e) => setSessionFormMeta((f) => ({ ...f, transportMode: e.target.value as TransportMode }))}
                    >
                      {TRANSPORT_MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('purchases.vehicleTracking')}</label>
                    <input
                      className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                      placeholder={t('purchases.vehiclePlaceholder')}
                      value={sessionFormMeta.vehicleOrTrackingNo}
                      onChange={(e) => setSessionFormMeta((f) => ({ ...f, vehicleOrTrackingNo: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('purchases.sessionNote')}</label>
                    <input
                      className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                      placeholder={t('purchases.notePlaceholder')}
                      value={sessionFormMeta.note}
                      onChange={(e) => setSessionFormMeta((f) => ({ ...f, note: e.target.value }))}
                    />
                  </div>

                  <p className="text-xs font-medium text-gray-700 pt-1">{t('purchases.enterQty')}</p>
                  {itemsWithRemaining.length === 0 ? (
                    <p className="text-xs text-gray-400">{t('purchases.allAccounted')}</p>
                  ) : (
                    itemsWithRemaining.map((item) => {
                      const remaining = item.qtyBought - item.qtyUsable - item.qtyDamaged;
                      const entry = sessionItemEntries[item.id];
                      const usable = Number(entry?.qtyUsable || '0');
                      const damaged = Number(entry?.qtyDamaged || '0');
                      const overLimit = usable + damaged > remaining;

                      const packets = Number(entry?.packets || '0');
                      const ipp = Number(entry?.itemsPerPacket || '0');
                      const expectedTotal = packets > 0 && ipp > 0 ? packets * ipp : null;

                      const EMPTY_ENTRY: SessionItemEntry = { qtyUsable: '', qtyDamaged: '', packets: '', itemsPerPacket: '' };
                      const upd = (patch: Partial<SessionItemEntry>) =>
                        setSessionItemEntries((s) => ({
                          ...s,
                          [item.id]: { ...EMPTY_ENTRY, ...s[item.id], ...patch },
                        }));

                      return (
                        <div key={item.id} className="bg-white border border-indigo-100 rounded-xl p-3 space-y-2.5">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                            <p className="text-xs text-gray-400">{item.variantSku} · {t('purchases.remaining')}: <strong className="text-amber-600">{formatQty(remaining)}</strong></p>
                          </div>

                          {/* Packet helper — optional */}
                          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2 space-y-1.5">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('purchases.packingInfo')}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] text-gray-400 mb-0.5 block">{t('purchases.packets')}</label>
                                <input type="number" min="0" placeholder="e.g. 5"
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                                  value={entry?.packets ?? ''}
                                  onChange={(e) => {
                                    const packetsVal = e.target.value;
                                    const p = Number(packetsVal || '0');
                                    const perPacket = Number(entry?.itemsPerPacket || '0');
                                    const patch: Partial<SessionItemEntry> = { packets: packetsVal };
                                    if (p > 0 && perPacket > 0) patch.qtyUsable = String(p * perPacket);
                                    upd(patch);
                                  }}
                                />
                              </div>
                              <span className="text-gray-300 text-lg mt-4">×</span>
                              <div className="flex-1">
                                <label className="text-[10px] text-gray-400 mb-0.5 block">{t('purchases.perPacket')}</label>
                                <input type="number" min="0" placeholder="e.g. 12"
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                                  value={entry?.itemsPerPacket ?? ''}
                                  onChange={(e) => {
                                    const ippVal = e.target.value;
                                    const ipp = Number(ippVal || '0');
                                    const p = Number(entry?.packets || '0');
                                    const patch: Partial<SessionItemEntry> = { itemsPerPacket: ippVal };
                                    if (p > 0 && ipp > 0) patch.qtyUsable = String(p * ipp);
                                    upd(patch);
                                  }}
                                />
                              </div>
                              {expectedTotal !== null && (
                                <div className="mt-4 text-right shrink-0 bg-gray-800 rounded-lg px-3 py-1.5">
                                  <p className="text-[10px] text-gray-300">{t('purchases.expected')}</p>
                                  <p className="text-lg font-bold text-white">{expectedTotal}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actual qty */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">{t('purchases.usableQty')}</label>
                              <input type="number" min="0" className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm"
                                value={entry?.qtyUsable ?? ''}
                                placeholder={expectedTotal !== null ? String(expectedTotal) : '0'}
                                onChange={(e) => upd({ qtyUsable: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">{t('purchases.damagedQty')}</label>
                              <input type="number" min="0" className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm"
                                value={entry?.qtyDamaged ?? ''}
                                placeholder="0"
                                onChange={(e) => upd({ qtyDamaged: e.target.value })}
                              />
                            </div>
                          </div>
                          {overLimit && (
                            <p className="text-xs text-red-500">{t('purchases.exceedsRemaining', { qty: formatQty(remaining) })}</p>
                          )}
                          {expectedTotal !== null && (() => {
                            const entered = Number(entry?.qtyUsable || '0') + Number(entry?.qtyDamaged || '0');
                            if (entered > 0 && entered !== expectedTotal) {
                              return (
                                <p className="text-[11px] text-amber-600">
                                  ⚠ Entered {entered} vs {expectedTotal} {t('purchases.expected')} ({expectedTotal - entered > 0 ? `${expectedTotal - entered} ${t('purchases.unaccounted')}` : `${entered - expectedTotal} ${t('purchases.extra')}`})
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      );
                    })
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => createSessionMutation.mutate()}
                      disabled={createSessionMutation.isPending || itemsWithRemaining.length === 0}
                      className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      {createSessionMutation.isPending ? t('purchases.submitting') : isOwner ? t('purchases.submitApprove') : t('purchases.submitApproval')}
                    </button>
                    <button onClick={() => { setShowAddSession(false); setSessionItemEntries({}); }}
                      className="px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-200">{t('common.cancel')}</button>
                  </div>
                  {!isOwner && (
                    <p className="text-xs text-gray-400 text-center">{t('purchases.staffNote')}</p>
                  )}
                  {isOwner && (
                    <p className="text-xs text-indigo-600 text-center">{t('purchases.ownerNote')}</p>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowAddSession(true)}
                  className="w-full border-2 border-dashed border-indigo-200 rounded-xl py-3 text-sm text-indigo-600 font-medium">
                  {t('purchases.recordGoods')}
                </button>
              )}
            </>
          )}

          {/* Close trip — owner only */}
          {isOwner && isReceiving && !showAddSession && (
            <div className="pt-2 border-t border-gray-100">
              {!showCloseConfirm && !forceCloseRequired && (
                <button
                  onClick={() => setShowCloseConfirm(true)}
                  className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium"
                >
                  {t('purchases.closeTrip')}
                </button>
              )}

              {showCloseConfirm && !forceCloseRequired && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-800">{t('purchases.closeTripTitle')}</p>
                  <p className="text-xs text-gray-500">
                    {itemsWithRemaining.length > 0
                      ? t('purchases.closeUnaccountedDesc', { count: itemsWithRemaining.length })
                      : t('purchases.closeSafeDesc')}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowCloseConfirm(false)}
                      className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm">{t('common.cancel')}</button>
                    <button onClick={() => closeTripMutation.mutate(undefined)} disabled={closeTripMutation.isPending}
                      className="flex-1 bg-gray-800 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                      {closeTripMutation.isPending ? t('purchases.closing') : t('purchases.closeTrip')}
                    </button>
                  </div>
                </div>
              )}

              {forceCloseRequired && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800">{t('purchases.forceCloseTitle')}</p>
                  <div className="space-y-1">
                    {forceCloseRequired.items.map((item) => (
                      <div key={item.variantSku} className="flex justify-between text-xs bg-white border border-amber-100 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-gray-400">{item.variantSku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-500">{t('purchases.orderedLabel')}: {item.qtyBought}</p>
                          <p className="text-amber-700">{t('purchases.missingLabel')}: <strong>{item.qtyUnaccounted}</strong></p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    placeholder={t('purchases.forceCloseReason')}
                    value={forceCloseReason}
                    onChange={(e) => setForceCloseReason(e.target.value)}
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setForceCloseRequired(null); setForceCloseReason(''); setShowCloseConfirm(false); }}
                      className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm">{t('common.cancel')}</button>
                    <button
                      onClick={() => closeTripMutation.mutate(forceCloseReason)}
                      disabled={!forceCloseReason.trim() || closeTripMutation.isPending}
                      className="flex-1 bg-amber-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      {closeTripMutation.isPending ? t('purchases.closing') : t('purchases.forceClose')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom action bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[768px] bg-white border-t border-gray-100 px-4 py-3 space-y-2">
        {isDraft && tab === 'items' && !isOwner && trip.items.length > 0 && (
          <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}
            className="w-full bg-amber-500 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
            {submitMutation.isPending ? t('purchases.submitting') : t('purchases.submitForApproval')}
          </button>
        )}

        {trip.status === 'PENDING_APPROVAL' && isOwner && (
          <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
            {approveMutation.isPending ? t('purchases.approving') : t('purchases.approveStartReceiving')}
          </button>
        )}

        {!isCompleted && trip.status !== 'CANCELLED' && (
          <button onClick={() => { if (confirm(t('purchases.cancelTripConfirm'))) cancelMutation.mutate(); }}
            disabled={cancelMutation.isPending}
            className="w-full py-2.5 rounded-xl text-sm text-red-500 border border-red-200 font-medium">
            {t('purchases.cancelTrip')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── SessionCard ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  colorClass,
  items,
  isOwner,
  isPreviewLoading,
  currentPreview,
  onPreview,
  onApprove,
  onReject,
  isApproving,
  t,
  transportModeOptions,
}: {
  session: PurchaseReceiveSessionDto;
  colorClass: string;
  items: PurchaseItemDto[];
  isOwner: boolean;
  isPreviewLoading: boolean;
  currentPreview: SessionPreview | null;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  transportModeOptions: { value: string; label: string }[];
}) {
  const transportLabel = transportModeOptions.find((m) => m.value === session.transportMode)?.label ?? session.transportMode;

  const statusBadge =
    session.status === 'APPROVED'
      ? <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{t('purchases.sessionApproved')}</span>
      : session.status === 'REJECTED'
        ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{t('purchases.sessionRejected')}</span>
        : <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{t('purchases.sessionPending')}</span>;

  return (
    <div className={`border rounded-xl p-3 mb-2 space-y-2 ${colorClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{session.sessionNo}</p>
            {statusBadge}
          </div>
          <p className="text-xs opacity-70 mt-0.5">{formatDate(session.receivedAt)} · {session.receivedByName}</p>
          <p className="text-xs opacity-70">{transportLabel}{session.vehicleOrTrackingNo ? ` · ${session.vehicleOrTrackingNo}` : ''}</p>
          {session.note && <p className="text-xs opacity-60 italic mt-0.5">{session.note}</p>}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {session.items.map((si) => {
          const item = items.find((i) => i.id === si.purchaseItemId);
          const lot = (() => {
            try { return si.perLotValuesJson ? JSON.parse(si.perLotValuesJson) : null; } catch { return null; }
          })();
          const hasPackets = lot?.packets > 0;
          return (
            <div key={si.id} className="text-xs">
              <div className="flex justify-between">
                <span className="opacity-80 truncate">{item?.productName ?? si.purchaseItemId} <span className="opacity-50">({item?.variantSku})</span></span>
                <span className="shrink-0 ml-2 font-medium">
                  {si.qtyUsable > 0 && <span className="text-green-700">+{formatQty(si.qtyUsable)}</span>}
                  {si.qtyUsable > 0 && si.qtyDamaged > 0 && <span className="opacity-50"> / </span>}
                  {si.qtyDamaged > 0 && <span className="text-red-600">{formatQty(si.qtyDamaged)} {t('purchases.dmg')}</span>}
                </span>
              </div>
              {hasPackets && (
                <p className="opacity-50 mt-0.5">
                  {lot.packets} {t('purchases.pkt')}{lot.itemsPerPacket > 0 ? ` × ${lot.itemsPerPacket} = ${lot.packets * lot.itemsPerPacket} ${t('purchases.expected')}` : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {session.status === 'REJECTED' && session.rejectionReason && (
        <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1">{t('purchases.sessionRejected')}: {session.rejectionReason}</p>
      )}

      {session.status === 'APPROVED' && session.approvedByName && (
        <p className="text-[11px] opacity-60">{t('purchases.approvedBy')} {session.approvedByName}{session.approvedAt ? ` · ${formatDate(session.approvedAt)}` : ''}</p>
      )}

      {/* Preview */}
      {currentPreview && (
        <div className="bg-white/60 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold">{t('purchases.landedCostPreview')}</p>
          {currentPreview.items.map((p) => (
            <div key={p.purchaseItemId} className="text-xs">
              <p className="font-medium">{p.productName} <span className="opacity-50">({p.variantSku})</span></p>
              <p className="opacity-70">
                Landed: <strong>৳{p.landedUnitCost}/unit</strong> · {t('purchases.newAvg')}: <strong>৳{p.newAvgCost}</strong>
                <span className="opacity-60"> (was ৳{p.currentAvgCost})</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* OWNER actions */}
      {isOwner && session.status === 'PENDING_APPROVAL' && (
        <div className="flex gap-2 pt-1">
          {!currentPreview && (
            <button onClick={onPreview} disabled={isPreviewLoading}
              className="flex-1 bg-white/70 border border-current py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
              {isPreviewLoading ? '…' : t('purchases.preview')}
            </button>
          )}
          <button onClick={onApprove} disabled={isApproving}
            className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">
            {isApproving ? t('purchases.approving') : t('common.approve')}
          </button>
          <button onClick={onReject}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-600 bg-white/70">
            {t('common.reject')}
          </button>
        </div>
      )}
    </div>
  );
}
