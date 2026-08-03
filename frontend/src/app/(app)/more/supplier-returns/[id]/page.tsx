'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SlidePanel from '@/components/ui/SlidePanel';
import CustomSelect from '@/components/ui/CustomSelect';
import DamagedStockPicker from '@/components/purchases/DamagedStockPicker';
import {
  getSupplierReturn,
  addSupplierReturnItem,
  updateSupplierReturnItem,
  removeSupplierReturnItem,
  submitSupplierReturn,
  resolveSupplierReturn,
  cancelSupplierReturn,
} from '@/lib/supplierReturnsApi';
import type { ResolutionType, SupplierReturnItemDto, DamagedStockItem } from '@/types/supplierReturns';
import { useLanguage } from '@/i18n/LanguageContext';
import { toastError } from '@/lib/toastError';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const RESOLUTION_COLORS: Record<string, string> = {
  REFUND: 'bg-blue-50 text-blue-700',
  REPLACEMENT: 'bg-violet-50 text-violet-700',
  CREDIT_NOTE: 'bg-teal-50 text-teal-700',
  WRITE_OFF: 'bg-red-50 text-red-700',
};

const formatQty = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 3 });

interface ItemFormState {
  variant: DamagedStockItem | { variantId: string; productName: string; variantSku: string; unitCode: string } | null;
  qtyReturned: string;
  unitCost: string;
  resolutionType: ResolutionType;
  resolutionAmount: string;
  note: string;
}

const EMPTY_FORM: ItemFormState = {
  variant: null,
  qtyReturned: '',
  unitCost: '',
  resolutionType: 'WRITE_OFF',
  resolutionAmount: '',
  note: '',
};

export default function SupplierReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useLanguage();

  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplierReturnItemDto | null>(null);
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showResolveConfirm, setShowResolveConfirm] = useState(false);

  const RESOLUTION_OPTIONS: { value: ResolutionType; label: string }[] = [
    { value: 'WRITE_OFF', label: t('supplierReturns.resolutionWriteOff') },
    { value: 'REFUND', label: t('supplierReturns.resolutionRefund') },
    { value: 'CREDIT_NOTE', label: t('supplierReturns.resolutionCreditNote') },
    { value: 'REPLACEMENT', label: t('supplierReturns.resolutionReplacement') },
  ];

  const RESOLUTION_LABELS: Record<string, string> = {
    WRITE_OFF: t('supplierReturns.resolutionWriteOff'),
    REFUND: t('supplierReturns.resolutionRefund'),
    CREDIT_NOTE: t('supplierReturns.resolutionCreditNote'),
    REPLACEMENT: t('supplierReturns.resolutionReplacement'),
  };

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: t('supplierReturns.statusDraft'),
    SUBMITTED: t('supplierReturns.statusSubmitted'),
    RESOLVED: t('supplierReturns.statusResolved'),
    CANCELLED: t('supplierReturns.statusCancelled'),
  };

  const { data: ret, isLoading } = useQuery({
    queryKey: ['supplier-return', id],
    queryFn: () => getSupplierReturn(id),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['supplier-return', id] });
  const invalidateList = () => qc.invalidateQueries({ queryKey: ['supplier-returns'] });

  const resetItemForm = () => {
    setShowAddItem(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  };

  const openEditItem = (item: SupplierReturnItemDto) => {
    setEditingItem(item);
    setForm({
      variant: { variantId: item.variantId, productName: item.productName, variantSku: item.variantSku, unitCode: item.unitCode },
      qtyReturned: String(item.qtyReturned),
      unitCost: String(item.unitCost),
      resolutionType: item.resolutionType,
      resolutionAmount: item.resolutionAmount != null ? String(item.resolutionAmount) : '',
      note: item.note ?? '',
    });
    setShowAddItem(true);
  };

  const saveItemMutation = useMutation({
    mutationFn: () => {
      const payload = {
        variantId: form.variant!.variantId,
        qtyReturned: Number(form.qtyReturned),
        unitCost: Number(form.unitCost),
        resolutionType: form.resolutionType,
        resolutionAmount: form.resolutionAmount ? Number(form.resolutionAmount) : undefined,
        note: form.note.trim() || undefined,
      };
      return editingItem
        ? updateSupplierReturnItem(id, editingItem.id, payload)
        : addSupplierReturnItem(id, payload);
    },
    onSuccess: () => { invalidate(); resetItemForm(); },
    onError: (err: unknown) => toastError(err, t('supplierReturns.failedSaveItem')),
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => removeSupplierReturnItem(id, itemId),
    onSuccess: invalidate,
    onError: (err: unknown) => toastError(err, t('common.error')),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitSupplierReturn(id),
    onSuccess: () => { invalidate(); invalidateList(); },
    onError: (err: unknown) => toastError(err, t('common.error')),
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveSupplierReturn(id),
    onSuccess: () => { invalidate(); invalidateList(); },
    onError: (err: unknown) => toastError(err, t('common.error')),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSupplierReturn(id),
    onSuccess: () => { invalidate(); invalidateList(); },
    onError: (err: unknown) => toastError(err, t('common.error')),
  });

  if (isLoading || !ret) {
    return (
      <div className="px-4 py-8 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const isDraft = ret.status === 'DRAFT';
  const isSubmitted = ret.status === 'SUBMITTED';
  const totalValue = ret.items.reduce((s, i) => s + i.qtyReturned * i.unitCost, 0);

  const qtyNumber = Number(form.qtyReturned);
  const unitCostNumber = Number(form.unitCost);
  const canSaveItem = !!form.variant && Number.isFinite(qtyNumber) && qtyNumber > 0
    && Number.isFinite(unitCostNumber) && unitCostNumber >= 0 && !saveItemMutation.isPending;

  const needsResolutionAmount = form.resolutionType === 'REFUND' || form.resolutionType === 'CREDIT_NOTE';

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-semibold text-gray-900 truncate">{ret.supplierReturnNo}</h1>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none shrink-0 ${STATUS_COLORS[ret.status]}`}>
              {STATUS_LABELS[ret.status] ?? ret.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">{ret.supplierName}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-orange-800 px-4 py-3 flex gap-5 text-sm flex-wrap">
        <div>
          <p className="text-[10px] text-orange-200">{t('supplierReturns.itemCount')}</p>
          <p className="font-semibold text-white text-sm">{ret.items.length}</p>
        </div>
        <div>
          <p className="text-[10px] text-orange-200">{t('supplierReturns.totalQty')}</p>
          <p className="font-semibold text-white text-sm">{formatQty(ret.items.reduce((s, i) => s + i.qtyReturned, 0))}</p>
        </div>
        <div>
          <p className="text-[10px] text-orange-200">{t('supplierReturns.totalValue')}</p>
          <p className="font-bold text-white text-sm">৳{totalValue.toLocaleString()}</p>
        </div>
      </div>

      {ret.note && (
        <p className="px-4 pt-3 text-xs text-gray-500">📝 {ret.note}</p>
      )}
      {ret.tripNo && (
        <p className="px-4 pt-2 text-xs text-gray-400">{t('supplierReturns.originTrip')}: {ret.tripNo}</p>
      )}

      {/* Items */}
      <div className="px-4 pt-3 space-y-2">
        {ret.items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('supplierReturns.noItems')}</p>
        ) : (
          ret.items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-400">{item.variantSku}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-xs text-gray-600">{formatQty(item.qtyReturned)} {item.unitCode} × ৳{item.unitCost}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${RESOLUTION_COLORS[item.resolutionType]}`}>
                      {RESOLUTION_LABELS[item.resolutionType] ?? item.resolutionType}
                    </span>
                  </div>
                  {item.resolutionAmount != null && (
                    <p className="text-xs text-gray-500 mt-1">{t('supplierReturns.resolutionAmount')}: ৳{item.resolutionAmount.toLocaleString()}</p>
                  )}
                  {item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}
                </div>
                {isDraft && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => openEditItem(item)} className="text-xs text-indigo-600 font-medium px-2 py-1">
                      {t('common.edit')}
                    </button>
                    <button onClick={() => removeItemMutation.mutate(item.id)} className="text-xs text-red-500 font-medium px-2 py-1">
                      {t('common.remove')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isDraft && (
          <button
            onClick={() => setShowAddItem(true)}
            className="w-full border-2 border-dashed border-indigo-200 rounded-xl py-3 text-sm text-indigo-600 font-medium"
          >
            {ret.items.length > 0 ? t('supplierReturns.addMoreItem') : t('supplierReturns.addItem')}
          </button>
        )}
      </div>

      {/* Add/Edit item panel */}
      <SlidePanel
        open={showAddItem}
        onClose={resetItemForm}
        title={editingItem ? t('supplierReturns.editItem') : t('supplierReturns.addItem')}
        footer={
          <button
            onClick={() => saveItemMutation.mutate()}
            disabled={!canSaveItem}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {saveItemMutation.isPending ? t('common.saving') : editingItem ? t('common.update') : t('common.add')}
          </button>
        }
      >
        <div className="px-4 py-4 space-y-3">
          {!editingItem && (
            <button
              type="button"
              onClick={() => setShowProductPicker(true)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left"
            >
              {form.variant ? (
                <span className="text-gray-900 font-medium">{form.variant.productName} <span className="text-gray-400">({form.variant.variantSku})</span></span>
              ) : (
                <span className="text-gray-400">{t('supplierReturns.pickDamagedItem')}</span>
              )}
            </button>
          )}

          {(editingItem || form.variant) && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{t('supplierReturns.qtyReturned')}</label>
                  <input type="number" min="0" step="0.001"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                    value={form.qtyReturned}
                    onChange={(e) => setForm((f) => ({ ...f, qtyReturned: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{t('supplierReturns.unitCost')}</label>
                  <input type="number" min="0" step="0.01"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                    value={form.unitCost}
                    onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">{t('supplierReturns.resolutionType')}</label>
                <CustomSelect
                  value={form.resolutionType}
                  onChange={(v) => setForm((f) => ({ ...f, resolutionType: v as ResolutionType }))}
                  options={RESOLUTION_OPTIONS}
                />
              </div>

              {needsResolutionAmount && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{t('supplierReturns.resolutionAmount')}</label>
                  <input type="number" min="0" step="0.01"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                    placeholder="0"
                    value={form.resolutionAmount}
                    onChange={(e) => setForm((f) => ({ ...f, resolutionAmount: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-gray-500 mb-1 block">{t('supplierReturns.itemNote')}</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>
      </SlidePanel>

      <DamagedStockPicker
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        branchId={ret.branchId}
        onSelect={(item: DamagedStockItem) => {
          setForm((f) => ({
            ...f,
            variant: item,
            qtyReturned: f.qtyReturned || String(item.damagedQty),
            unitCost: f.unitCost || String(item.avgLandedCost),
          }));
          setShowProductPicker(false);
        }}
      />

      {/* Bottom action bar */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[768px] bg-white border-t border-gray-100 px-4 py-3 space-y-2">
        {isDraft && (
          showCancelConfirm ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
              <p className="text-xs text-red-800">{t('supplierReturns.cancelConfirm')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm"
                >
                  {t('common.no')}
                </button>
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {cancelMutation.isPending ? t('common.saving') : t('common.yes')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => submitMutation.mutate()}
                disabled={ret.items.length === 0 || submitMutation.isPending}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {submitMutation.isPending ? t('common.saving') : t('supplierReturns.submitReturn')}
              </button>
            </div>
          )
        )}
        {isSubmitted && (
          showResolveConfirm ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
              <p className="text-xs text-emerald-800">{t('supplierReturns.resolveConfirm')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResolveConfirm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm"
                >
                  {t('common.no')}
                </button>
                <button
                  onClick={() => resolveMutation.mutate()}
                  disabled={resolveMutation.isPending}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {resolveMutation.isPending ? t('common.saving') : t('common.yes')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowResolveConfirm(true)}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-semibold"
            >
              {t('supplierReturns.resolveReturn')}
            </button>
          )
        )}
        {ret.status === 'RESOLVED' && ret.resolvedByName && (
          <p className="text-xs text-gray-400 text-center">
            {t('supplierReturns.resolvedBy')} {ret.resolvedByName}
            {ret.resolvedAt && ` · ${new Date(ret.resolvedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        )}
      </div>
    </div>
  );
}
