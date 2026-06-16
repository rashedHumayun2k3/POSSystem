'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProduct, archiveProduct, getPriceHistory, changePrice } from '@/lib/catalogApi';
import { useAuthStore } from '@/store/authStore';
import type { Variant, PriceHistoryEntry } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';

type TabKey = 'info' | 'variants' | 'prices';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);

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
          {isOwner && product.status === 'ACTIVE' && (
            <button
              onClick={() => archiveMutation.mutate()}
              className="text-xs text-red-500 font-medium border border-red-200 px-2 py-1 rounded-lg"
            >
              {t('products.archive')}
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
            t={t}
          />
        )}
      </div>
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
  onSelectForPrice,
  t,
}: {
  variants: Variant[];
  isOwner: boolean;
  onSelectForPrice: (v: Variant) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-2">
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
              <button
                onClick={() => onSelectForPrice(v)}
                className="mt-2 text-xs text-indigo-600 font-medium"
              >
                {t('products.changePriceArrow')}
              </button>
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
  t,
}: {
  variants: Variant[];
  selectedVariant: Variant | null;
  onSelectVariant: (v: Variant) => void;
  t: (key: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [revertAt, setRevertAt] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const active = selectedVariant ?? variants[0];

  const { data: history = [] } = useQuery({
    queryKey: ['priceHistory', active?.id],
    queryFn: () => getPriceHistory(active.id),
    enabled: !!active,
  });

  const mutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (payload: any) => changePrice(active.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priceHistory', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
      setShowForm(false);
      setNewPrice('');
      setReason('');
      setEffectiveFrom('');
      setRevertAt('');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? t('products.failedChangePrice'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newPrice || !reason.trim()) { setError(t('products.priceAndReasonRequired')); return; }
    mutation.mutate({
      variantId: active.id,
      newPrice: parseFloat(newPrice),
      reason: reason.trim(),
      effectiveFrom: effectiveFrom || null,
      revertAt: revertAt || null,
    });
  };

  return (
    <div className="space-y-4">
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

      {/* Change price button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full border border-indigo-300 text-indigo-600 font-medium py-2.5 rounded-xl text-sm"
        >
          {t('products.changePriceBtn')}
        </button>
      )}

      {/* Change price form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-indigo-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-900">{t('products.changePriceTitle')}</p>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={t('products.newPricePlaceholder')}
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            required
          />
          <input
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={t('products.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-indigo-600">{t('products.effectiveFrom')}</label>
              <input
                type="datetime-local"
                className="mt-1 w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-indigo-600">{t('products.autoRevertAt')}</label>
              <input
                type="datetime-local"
                className="mt-1 w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                value={revertAt}
                onChange={(e) => setRevertAt(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {mutation.isPending ? t('common.saving') : t('products.apply')}
            </button>
          </div>
        </form>
      )}

      {/* Price history */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('products.priceHistory')}</p>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('products.noPriceHistory')}</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <PriceHistoryRow key={entry.id} entry={entry} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceHistoryRow({ entry, t }: { entry: PriceHistoryEntry; t: (key: string) => string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 line-through">
            ৳{entry.oldPrice.toLocaleString()}
          </span>
          <span className="text-gray-400">→</span>
          <span className="text-sm font-semibold text-gray-900">
            ৳{entry.newPrice.toLocaleString()}
          </span>
          {entry.isScheduled && !entry.isRevert && (
            <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">{t('products.scheduled')}</span>
          )}
          {entry.isRevert && (
            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{t('products.autoRevert')}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1">{entry.reason}</p>
      <div className="flex justify-between mt-1">
        <p className="text-xs text-gray-400">{t('products.by')} {entry.changedByName}</p>
        <p className="text-xs text-gray-400">
          {new Date(entry.effectiveFrom).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </p>
      </div>
    </div>
  );
}
