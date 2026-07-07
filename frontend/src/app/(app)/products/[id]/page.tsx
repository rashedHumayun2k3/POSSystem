'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { getProduct, archiveProduct, getPriceSlots, createPriceSlot, activatePriceSlot, getPriceSlotHistory, downloadBarcodeLabels } from '@/lib/catalogApi';
import { listOrdersByProduct } from '@/lib/ordersApi';
import { useAuthStore } from '@/store/authStore';
import type { Variant, PriceSlot, PriceActivationLog } from '@/types/catalog';
import type { OrderListItem } from '@/types/orders';
import { useLanguage } from '@/i18n/LanguageContext';
import StatusBadge from '@/components/ui/StatusBadge';
import { resolveMediaUrl } from '@/lib/media';

type TabKey = 'info' | 'variants' | 'prices' | 'orders';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      router.back();
    },
  });

  if (isLoading) {
    return (
      <div className="px-4 pt-4 pb-20">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!product) return null;

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'info', label: t('products.tabInfo') },
    { key: 'variants', label: t('products.tabVariants') },
    ...(isOwner ? [{ key: 'prices' as TabKey, label: t('products.tabPrices') }] : []),
    { key: 'orders', label: 'Orders' },
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{product.name}</h1>
            <p className="text-xs text-gray-400">{product.sku} · {product.categoryName}</p>
          </div>
          {isOwner && (
            <Link
              href={`/products/${id}/edit`}
              className="text-xs text-indigo-600 font-medium border border-indigo-200 px-2 py-1 rounded-lg"
            >
              {t('products.edit')}
            </Link>
          )}
          {isOwner && product.status === 'ACTIVE' && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-red-500 font-medium border border-red-200 px-2 py-1 rounded-lg"
            >
              {t('products.delete')}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-3 border-b border-gray-100 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {activeTab === 'info' && <InfoTab product={product} isOwner={isOwner} t={t} />}
        {activeTab === 'variants' && (
          <VariantsTab
            variants={product.variants}
            isOwner={isOwner}
            productId={id}
            t={t}
            onSelectForPrice={(v) => {
              setSelectedVariant(v);
              setActiveTab('prices');
            }}
          />
        )}
        {activeTab === 'prices' && isOwner && (
          <PricesTab
            variants={product.variants}
            selectedVariant={selectedVariant}
            onSelectVariant={setSelectedVariant}
            baseSellingPrice={product.sellingPrice}
            marketPrice={product.marketPrice}
            packagingCostPerUnit={product.packagingCostPerUnit ?? 0}
            t={t}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab productId={id} />
        )}
      </div>

      {/* Delete confirmation — this calls the same archive endpoint as before (soft, reversible
          via the database — products with order/purchase history can never be truly deleted
          without breaking historical records), just presented as "Delete" since that's the
          action a shop owner expects. */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <p className="text-base font-semibold text-red-600">{t('products.deleteTitle')}</p>
            <p className="text-sm text-gray-500">{t('products.deleteWarning')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {archiveMutation.isPending ? t('products.deleting') : t('products.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Info Tab ──────────────────────────────────────────────────────────────────

function InfoTab({
  product,
  isOwner,
  t,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product: any;
  isOwner: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Photo */}
      {product.imageUrl && (
        <div className="w-full h-48 rounded-xl bg-gray-100 overflow-hidden">
          <img
            src={resolveMediaUrl(product.imageUrl) ?? ''}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Price block */}
      <div className="bg-indigo-50 rounded-xl p-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">{t('products.sellingPrice')}</p>
          <p className="text-2xl font-bold text-indigo-700">৳{product.sellingPrice.toLocaleString()}</p>
        </div>
        {product.marketPrice && (
          <div className="text-right">
            <p className="text-xs text-gray-500">{t('products.marketPrice')}</p>
            <p className="text-lg font-semibold text-gray-600">৳{product.marketPrice.toLocaleString()}</p>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="grid grid-cols-2 gap-3">
          <InfoTile label={t('products.packagingCostInfo')} value={`৳${product.packagingCostPerUnit ?? 0}`} />
          <InfoTile label={t('products.lowStockInfo')} value={`${product.lowStockThreshold} ${product.unitCode}`} />
        </div>
      )}

      {product.description && (
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium mb-1">{t('products.description')}</p>
          <p className="text-sm text-gray-700">{product.description}</p>
        </div>
      )}

      {product.note && (
        <div className="bg-yellow-50 rounded-xl p-3">
          <p className="text-xs text-yellow-600 font-medium mb-1">{t('products.note')}</p>
          <p className="text-sm text-gray-700">{product.note}</p>
        </div>
      )}

      <div className="flex gap-2">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          product.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {product.status === 'ACTIVE' ? t('products.active') : t('products.archived')}
        </span>
        <span className="text-xs text-gray-400 py-1">{t('products.unitInfo')}: {product.unitCode}</span>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

// ── Variants Tab ──────────────────────────────────────────────────────────────

function VariantsTab({
  variants,
  isOwner,
  productId,
  onSelectForPrice,
  t,
}: {
  variants: Variant[];
  isOwner: boolean;
  productId: string;
  onSelectForPrice: (v: Variant) => void;
  t: (key: string) => string;
}) {
  const [labelQty, setLabelQty] = useState(1);
  const [printingAll, setPrintingAll] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const handlePrintAll = async () => {
    setPrintingAll(true);
    try { await downloadBarcodeLabels(productId, labelQty); } finally { setPrintingAll(false); }
  };

  const handlePrintOne = async (variantId: string) => {
    setPrintingId(variantId);
    try { await downloadBarcodeLabels(productId, labelQty, variantId); } finally { setPrintingId(null); }
  };

  return (
    <div className="space-y-3">
      {/* Print labels toolbar */}
      {isOwner && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          <span className="text-xs text-gray-500 shrink-0">Qty per label</span>
          <input
            type="number"
            min={1}
            max={500}
            value={labelQty}
            onChange={(e) => setLabelQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
          />
          <button
            onClick={handlePrintAll}
            disabled={printingAll}
            className="ml-auto text-xs font-medium text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {printingAll ? 'Generating…' : '🖨 Print All Labels'}
          </button>
        </div>
      )}

      {variants.map((v) => {
        const vals = JSON.parse(v.variantValuesJson || '{}') as Record<string, string>;
        const label = Object.values(vals).filter(Boolean).join(' / ') || 'Default';

        return (
          <div key={v.id} className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('products.sku')}: {v.sku}</p>
                <p className="text-xs text-gray-400">{t('products.barcode')}: {v.barcode}</p>
              </div>
              <div className="text-right">
                {v.priceOverride != null ? (
                  <p className="text-sm font-semibold text-indigo-600">৳{v.priceOverride.toLocaleString()}</p>
                ) : (
                  <p className="text-xs text-gray-400">{t('products.basePrice')}</p>
                )}
                {isOwner && v.avgLandedCost != null && v.avgLandedCost > 0 && (
                  <p className="text-xs text-gray-400">{t('products.cost')}: ৳{v.avgLandedCost.toLocaleString()}</p>
                )}
              </div>
            </div>
            {isOwner && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => onSelectForPrice(v)}
                  className="text-xs text-indigo-600 font-medium"
                >
                  {t('products.changePriceArrow')}
                </button>
                <button
                  onClick={() => handlePrintOne(v.id)}
                  disabled={printingId === v.id}
                  className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-lg disabled:opacity-50"
                >
                  {printingId === v.id ? '…' : '🖨 Label'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Prices Tab ────────────────────────────────────────────────────────────────

function PricesTab({
  variants,
  selectedVariant,
  onSelectVariant,
  baseSellingPrice,
  marketPrice,
  packagingCostPerUnit,
  t,
}: {
  variants: Variant[];
  selectedVariant: Variant | null;
  onSelectVariant: (v: Variant) => void;
  baseSellingPrice: number;
  marketPrice: number | null;
  packagingCostPerUnit: number;
  t: (key: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();

  const active = selectedVariant ?? variants[0];

  const { data: slots = [] } = useQuery<PriceSlot[]>({
    queryKey: ['priceSlots', active?.id],
    queryFn: () => getPriceSlots(active.id),
    enabled: !!active,
  });

  const { data: history = [] } = useQuery<PriceActivationLog[]>({
    queryKey: ['priceSlotHistory', active?.id],
    queryFn: () => getPriceSlotHistory(active.id),
    enabled: !!active,
  });

  const createMutation = useMutation({
    mutationFn: () => createPriceSlot(active.id, {
      label: formLabel.trim(),
      newPrice: parseFloat(formPrice),
      reason: formReason.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priceSlots', active.id] });
      qc.invalidateQueries({ queryKey: ['priceSlotHistory', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
      setShowForm(false);
      setFormLabel('');
      setFormPrice('');
      setFormReason('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setFormError(e.response?.data?.message ?? t('products.failedCreateSlot'));
    },
  });

  const activateMutation = useMutation({
    mutationFn: (slotId: string) => activatePriceSlot(active.id, slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priceSlots', active.id] });
      qc.invalidateQueries({ queryKey: ['priceSlotHistory', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formLabel.trim()) { setFormError(t('products.slotLabelRequired')); return; }
    if (!formPrice || parseFloat(formPrice) <= 0) { setFormError(t('products.slotPriceRequired')); return; }
    createMutation.mutate();
  };

  const activeSlot = slots.find(s => s.isActive);
  const effectiveSellPrice = activeSlot?.price ?? (active?.priceOverride ?? baseSellingPrice);
  const landedCost = active?.avgLandedCost ?? 0;
  const totalCost = landedCost + packagingCostPerUnit;
  const currentMargin = effectiveSellPrice > 0
    ? ((effectiveSellPrice - totalCost) / effectiveSellPrice) * 100
    : 0;

  const previewPrice = parseFloat(formPrice);
  const previewMargin = !isNaN(previewPrice) && previewPrice > 0
    ? ((previewPrice - totalCost) / previewPrice) * 100
    : null;
  const isBelowCost = landedCost > 0 && previewMargin !== null && previewMargin < 0;

  const marginColor = (m: number) =>
    m >= 20 ? 'text-green-600' : m >= 10 ? 'text-amber-600' : 'text-red-600';
  const marginBg = (m: number) =>
    m >= 20 ? 'bg-green-50' : m >= 10 ? 'bg-amber-50' : 'bg-red-50';

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Cost snapshot card */}
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('products.costStructure')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">{t('products.avgBuyCost')}</span>
            <span className="text-xs font-medium text-gray-700">
              {landedCost > 0 ? `৳${landedCost.toLocaleString()}` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">{t('products.packagingCostInfo')}</span>
            <span className="text-xs font-medium text-gray-700">
              {packagingCostPerUnit > 0 ? `৳${packagingCostPerUnit.toLocaleString()}` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('products.totalCost')}</span>
            <span className="text-xs font-semibold text-gray-800">
              {totalCost > 0 ? `৳${totalCost.toLocaleString()}` : '—'}
            </span>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-2 sm:hidden" />
        <div className={`mt-2 rounded-xl border ${marginBg(currentMargin)} border-purple-100 p-2.5`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-purple-500">{t('products.marketPrice')}</span>
            <span className="text-base font-bold text-purple-700">
              {marketPrice ? `৳${marketPrice.toLocaleString()}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              {t('products.selling')} ৳{effectiveSellPrice.toLocaleString()} → {t('products.margin')}
            </span>
            <span className={`text-xs font-bold ${marginColor(currentMargin)}`}>
              {currentMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Variant selector */}
      {variants.length > 1 && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.selectVariant')}</label>
          <select
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={active?.id ?? ''}
            onChange={(e) => {
              const v = variants.find((x) => x.id === e.target.value);
              if (v) onSelectVariant(v);
            }}
          >
            {variants.map((v) => {
              const vals = JSON.parse(v.variantValuesJson || '{}') as Record<string, string>;
              const label = Object.values(vals).filter(Boolean).join(' / ') || 'Default';
              return <option key={v.id} value={v.id}>{label}</option>;
            })}
          </select>
        </div>
      )}

      {/* Price slots list — active always on top */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('products.priceSlots')}</p>
        <div className="space-y-2">
          {[...slots].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)).map((slot) => (
            <label
              key={slot.id}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                slot.isActive
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-gray-100 hover:border-gray-200'
              } ${activateMutation.isPending ? 'pointer-events-none opacity-60' : ''}`}
            >
              {/* Radio circle */}
              <div className="mt-0.5 shrink-0">
                <input
                  type="radio"
                  name={`slot-${active?.id}`}
                  checked={slot.isActive}
                  onChange={() => { if (!slot.isActive) activateMutation.mutate(slot.id); }}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  slot.isActive ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'
                }`}>
                  {slot.isActive && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${slot.isActive ? 'text-green-800' : 'text-gray-900'}`}>
                    {slot.label}
                  </span>
                  {slot.isActive && (
                    <span className="text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                      {t('products.currentlyUsed')}
                    </span>
                  )}
                </div>
                <p className={`text-lg font-bold mt-0.5 ${slot.isActive ? 'text-green-700' : 'text-gray-800'}`}>
                  ৳{slot.price.toLocaleString()}
                </p>
                {slot.reason && (
                  <p className="text-xs text-gray-500 mt-0.5">{slot.reason}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  {t('products.createdBy')} {slot.createdByName} · {fmtDate(slot.createdAt)}
                </p>
              </div>

              {/* "Is Currently Used" label on the right */}
              <div className="shrink-0 flex flex-col items-end justify-center">
                <span className={`text-[10px] font-medium ${slot.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {t('products.isCurrentlyUsed')}
                </span>
              </div>
            </label>
          ))}
        </div>

        {/* Add slot button / form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 w-full border border-dashed border-indigo-300 text-indigo-600 font-medium py-2.5 rounded-xl text-sm"
          >
            + {t('products.addPriceSlot')}
          </button>
        ) : (
          <form onSubmit={handleCreateSubmit} className="mt-3 bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
            <p className="text-sm font-semibold text-indigo-900">{t('products.newPriceSlot')}</p>
            <input
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder={t('products.slotLabelPlaceholder')}
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              required
            />
            <div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                placeholder={t('products.slotPricePlaceholder')}
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                required
              />
              {previewMargin !== null && (
                <div className={`mt-1.5 rounded-lg px-2.5 py-1 flex justify-between items-center ${marginBg(previewMargin)}`}>
                  <span className="text-xs text-gray-500">{t('products.marginAt')} ৳{previewPrice.toLocaleString()}</span>
                  <span className={`text-xs font-bold ${marginColor(previewMargin)}`}>
                    {previewMargin.toFixed(1)}%
                  </span>
                </div>
              )}
              {isBelowCost && (
                <div className="mt-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-red-700">
                    Below cost — total cost is ৳{totalCost.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Loss of ৳{(totalCost - previewPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per sale.
                  </p>
                </div>
              )}
            </div>
            <input
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder={t('products.slotReasonPlaceholder')}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
            />
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormLabel(''); setFormPrice(''); setFormReason(''); setFormError(''); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className={`flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-60 text-white ${isBelowCost ? 'bg-red-500' : 'bg-indigo-600'}`}
              >
                {createMutation.isPending ? t('common.saving') : t('products.createSlot')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Activation history table */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('products.activationHistory')}</p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">{t('products.slotLabel')}</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">{t('products.slotPrice')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">{t('products.activatedFrom')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">{t('products.activatedTo')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((log) => (
                  <tr key={log.id} className={log.deactivatedAt === null ? 'bg-indigo-50' : 'bg-white'}>
                    <td className="px-3 py-2 font-medium text-gray-800">{log.labelSnapshot}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-700">৳{log.priceSnapshot.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtDateTime(log.activatedAt)}</td>
                    <td className="px-3 py-2">
                      {log.deactivatedAt === null
                        ? <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">{t('products.active')}</span>
                        : <span className="text-gray-400">{fmtDateTime(log.deactivatedAt)}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, string> = {
  FACEBOOK: 'FB',
  WHATSAPP: 'WA',
  INSTAGRAM: 'IG',
  PHONE: '📞',
  SHOP: '🏪',
  ONLINE: '🌐',
};

function OrdersTab({ productId }: { productId: string }) {
  const { data: orders = [], isLoading } = useQuery<OrderListItem[]>({
    queryKey: ['product-orders', productId],
    queryFn: () => listOrdersByProduct(productId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No orders for this product yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/orders/${order.id}`}
          className="block bg-white rounded-xl shadow-sm border border-gray-100 p-3 active:bg-gray-50"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900">{order.orderNo}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                {CHANNEL_ICONS[order.channel] ?? order.channel}
              </span>
              {order.isDraft && (
                <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Draft</span>
              )}
            </div>
            <span className="text-sm font-semibold text-gray-900">৳{order.totalAmount.toLocaleString()}</span>
          </div>

          <div className="text-sm text-gray-700 mb-1">
            {order.customerName}{' '}
            <span className="text-gray-400 text-xs">{order.customerPhone}</span>
          </div>

          <div className="flex flex-wrap gap-1 items-center">
            <StatusBadge status={order.fulfillmentStatus} />
            <StatusBadge status={order.paymentStatus} />
            {order.dueAmount > 0 && (
              <span className="text-xs text-red-600 font-medium">
                বাকি ৳{order.dueAmount.toLocaleString()}
              </span>
            )}
            {order.handlingUserName && (
              <span className="text-xs text-gray-400 ml-auto">
                → {order.handlingUserName}
              </span>
            )}
          </div>

          <div className="text-xs text-gray-400 mt-1">
            {new Date(order.createdAt).toLocaleDateString('en-GB')}
            {order.trackingNo && (
              <span className="ml-2 text-indigo-600">{order.trackingNo}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
