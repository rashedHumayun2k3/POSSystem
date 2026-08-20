'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { createTrip, listTrips } from '@/lib/purchasesApi';
import type { SourceType } from '@/types/purchases';
import { useLanguage } from '@/i18n/LanguageContext';
import { toastError } from '@/lib/toastError';
import { PurchaseProcessGuide } from '@/components/purchases/PurchaseProgress';
import { useAuthStore } from '@/store/authStore';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  RECEIVING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const RETURN_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatQty = (value: number | null | undefined) =>
  isFiniteNumber(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '0';

type SourceOption = {
  type: SourceType;
  labelKey: string;
  descKey: string;
  emoji: string;
  idle: string;
  active: string;
  text: string;
  check: string;
};

const SOURCE_OPTIONS: SourceOption[] = [
  {
    type: 'CHINA_TRIP',
    labelKey: 'purchases.chinaTripLabel',
    descKey: 'purchases.chinaTripDesc',
    emoji: '🇨🇳',
    idle:   'bg-red-50   border-red-100',
    active: 'bg-red-100  border-red-500',
    text:   'text-red-900',
    check:  'bg-red-500',
  },
  {
    type: 'ONLINE_WHOLESALE',
    labelKey: 'purchases.onlineWholesaleLabel',
    descKey: 'purchases.onlineWholesaleDesc',
    emoji: '📦',
    idle:   'bg-orange-50   border-orange-100',
    active: 'bg-orange-100  border-orange-500',
    text:   'text-orange-900',
    check:  'bg-orange-500',
  },
  {
    type: 'LOCAL_WHOLESALE',
    labelKey: 'purchases.localLabel',
    descKey: 'purchases.localDesc',
    emoji: '🏪',
    idle:   'bg-emerald-50   border-emerald-100',
    active: 'bg-emerald-100  border-emerald-500',
    text:   'text-emerald-900',
    check:  'bg-emerald-500',
  },
  {
    type: 'AGENT',
    labelKey: 'purchases.agentLabel',
    descKey: 'purchases.agentDesc',
    emoji: '🤝',
    idle:   'bg-violet-50   border-violet-100',
    active: 'bg-violet-100  border-violet-500',
    text:   'text-violet-900',
    check:  'bg-violet-500',
  },
  {
    type: 'FACTORY_DIRECT',
    labelKey: 'purchases.factoryDirectLabel',
    descKey: 'purchases.factoryDirectDesc',
    emoji: '🏭',
    idle:   'bg-sky-50   border-sky-100',
    active: 'bg-sky-100  border-sky-500',
    text:   'text-sky-900',
    check:  'bg-sky-500',
  },
  {
    type: 'IMPORTER_DISTRIBUTOR',
    labelKey: 'purchases.importerDistributorLabel',
    descKey: 'purchases.importerDistributorDesc',
    emoji: '🚚',
    idle:   'bg-cyan-50   border-cyan-100',
    active: 'bg-cyan-100  border-cyan-500',
    text:   'text-cyan-900',
    check:  'bg-cyan-500',
  },
  {
    type: 'SOCIAL_SUPPLIER',
    labelKey: 'purchases.socialSupplierLabel',
    descKey: 'purchases.socialSupplierDesc',
    emoji: '💬',
    idle:   'bg-blue-50   border-blue-100',
    active: 'bg-blue-100  border-blue-500',
    text:   'text-blue-900',
    check:  'bg-blue-500',
  },
  {
    type: 'EXISTING_SUPPLIER_REORDER',
    labelKey: 'purchases.existingSupplierReorderLabel',
    descKey: 'purchases.existingSupplierReorderDesc',
    emoji: '🔁',
    idle:   'bg-slate-50   border-slate-100',
    active: 'bg-slate-100  border-slate-500',
    text:   'text-slate-900',
    check:  'bg-slate-500',
  },
];

function defaultName(sourceType: SourceType, label: string): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${label}-Purchase-Order-${yyyy}-${mm}-${dd}`;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const isOwner = useAuthStore((state) => state.isOwner());
  const [selected, setSelected] = useState<SourceType | null>(null);
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [historyTab, setHistoryTab] = useState<'INCOMPLETE' | 'COMPLETED'>('INCOMPLETE');
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleSourceSelect = (opt: SourceOption) => {
    setSelected(opt.type);
    if (!nameEdited) setName(defaultName(opt.type, t(opt.labelKey)));
  };

  const mutation = useMutation({
    mutationFn: () => {
      const selectedOpt = SOURCE_OPTIONS.find((o) => o.type === selected);
      return createTrip({
        sourceType: selected!,
        note: name.trim() || (selectedOpt ? defaultName(selected!, t(selectedOpt.labelKey)) : undefined),
      });
    },
    onSuccess: (trip) => router.replace(`/more/purchases/${trip.id}`),
    onError: (err: unknown) => toastError(err, t('purchases.failedCreate')),
  });

  const selectedOpt = SOURCE_OPTIONS.find((o) => o.type === selected);

  const SOURCE_LABELS: Record<string, string> = {
    CHINA_TRIP:      t('purchases.chinaTripLabel'),
    ONLINE_WHOLESALE: t('purchases.onlineWholesaleLabel'),
    ALIBABA:         t('purchases.onlineWholesaleLabel'),
    LOCAL_WHOLESALE: t('purchases.localLabel'),
    AGENT:           t('purchases.agentLabel'),
    FACTORY_DIRECT: t('purchases.factoryDirectLabel'),
    IMPORTER_DISTRIBUTOR: t('purchases.importerDistributorLabel'),
    SOCIAL_SUPPLIER: t('purchases.socialSupplierLabel'),
    EXISTING_SUPPLIER_REORDER: t('purchases.existingSupplierReorderLabel'),
  };

  const STATUS_LABELS: Record<string, string> = {
    DRAFT:            t('purchases.statusDraft'),
    PENDING_APPROVAL: t('purchases.statusPending'),
    RECEIVING:        t('purchases.statusReceiving'),
    COMPLETED:        t('purchases.statusCompleted'),
    CANCELLED:        t('purchases.statusCancelled'),
  };

  const getHistoryStatusLabel = (status: string, itemCount: number) => {
    if (status !== 'DRAFT') return STATUS_LABELS[status] ?? status;
    if (itemCount === 0) return t('purchases.nextStepAddProduct');
    return isOwner
      ? t('purchases.nextStepReceiveProduct')
      : t('purchases.nextStepSubmitApproval');
  };

  const RETURN_STATUS_LABELS: Record<string, string> = {
    DRAFT:     t('supplierReturns.statusDraft'),
    SUBMITTED: t('supplierReturns.statusSubmitted'),
    RESOLVED:  t('supplierReturns.statusResolved'),
    CANCELLED: t('supplierReturns.statusCancelled'),
  };

  const { data: history = [] } = useQuery({
    queryKey: ['purchase-trips', ''],
    queryFn: () => listTrips(),
  });

  const historyTabs: { labelKey: string; value: 'INCOMPLETE' | 'COMPLETED' }[] = [
    { labelKey: 'purchases.tabIncomplete', value: 'INCOMPLETE' },
    { labelKey: 'purchases.tabCompleted', value: 'COMPLETED' },
  ];

  const visibleHistory = history.filter((trip) =>
    historyTab === 'COMPLETED' ? trip.status === 'COMPLETED' : trip.status !== 'COMPLETED'
  );

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('purchases.newTitle')}</h1>
      </div>

      <div className="px-4 pt-5 space-y-4">
        <p className="text-sm text-gray-500">{t('purchases.selectSource')}</p>

        {/* Source tiles */}
        <div className="grid grid-cols-2 gap-3">
          {SOURCE_OPTIONS.map((opt) => {
            const isSelected = selected === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => handleSourceSelect(opt)}
                className={`relative flex flex-col items-start p-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                  isSelected ? opt.active : opt.idle
                }`}
              >
                {isSelected && (
                  <span className={`absolute top-3 right-3 w-5 h-5 rounded-full ${opt.check} flex items-center justify-center`}>
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
                <span className="text-3xl mb-2">{opt.emoji}</span>
                <p className={`text-sm font-semibold ${opt.text}`}>{t(opt.labelKey)}</p>
                <p className={`text-xs mt-0.5 text-left ${isSelected ? opt.text + ' opacity-70' : 'text-gray-400'}`}>{t(opt.descKey)}</p>
              </button>
            );
          })}
        </div>

        {/* Order name */}
        {selected && selectedOpt && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('purchases.orderName')}</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder={defaultName(selected, t(selectedOpt.labelKey))}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameEdited(true); }}
            />
            <p className="text-[11px] text-gray-400 mt-1">{t('purchases.orderNameHint')}</p>
          </div>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={!selected || mutation.isPending}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition"
        >
          {mutation.isPending ? t('common.creating') : t('purchases.startOrder')}
        </button>

        {/* Purchase history */}
        {history.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              className="flex w-full items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-3 text-left transition active:bg-indigo-100"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">{t('purchases.historyTitle')}</span>
              <ChevronDownIcon className={`h-4 w-4 text-indigo-500 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </button>

            {historyOpen && (
              <div className="pt-3">
                <div className="mb-2 flex justify-end">
                  <div className="flex gap-1 rounded-full bg-gray-100 p-0.5">
                    {historyTabs.map((tab) => (
                      <button
                        type="button"
                        key={tab.value}
                        onClick={() => setHistoryTab(tab.value)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                          historyTab === tab.value
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-500'
                        }`}
                      >
                        {t(tab.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-2">
                  <PurchaseProcessGuide activeStep={historyTab === 'COMPLETED' ? 'COMPLETED' : 'DRAFT'} t={t} />
                </div>
                <div className="space-y-1.5">
                  {visibleHistory.slice(0, 5).map((trip) => {
                    const date = new Date(trip.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    });
                    const cost = (trip.totalItemCost + trip.totalSharedCost).toLocaleString();
                    return (
                      <Link
                        key={trip.id}
                        href={`/more/purchases/${trip.id}`}
                        className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2.5 active:scale-[0.99] transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-gray-900">{trip.tripNo}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${STATUS_COLORS[trip.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {getHistoryStatusLabel(trip.status, trip.itemCount)}
                            </span>
                            <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] text-gray-500">
                              {t('purchases.poDate')}: {date}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            {SOURCE_LABELS[trip.sourceType] ?? trip.sourceType}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-gray-500">
                            <span>{t('purchases.historyProducts')}: <strong>{trip.itemCount}</strong></span>
                            <span>{t('purchases.historyTotalCost')}: <strong>৳{cost}</strong></span>
                            <span>{t('purchases.historyReceivedQty')}: <strong>{formatQty(trip.totalQtyUsable)}/{formatQty(trip.totalQtyBought)}</strong></span>
                            {isFiniteNumber(trip.totalQtyDamaged) && trip.totalQtyDamaged > 0 && (
                              <span className="flex items-center gap-0.5 text-red-500 font-medium">⚠ {formatQty(trip.totalQtyDamaged)}</span>
                            )}
                            {trip.supplierReturnStatus && (
                              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium ${RETURN_STATUS_COLORS[trip.supplierReturnStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                                ↩️ {RETURN_STATUS_LABELS[trip.supplierReturnStatus] ?? trip.supplierReturnStatus}
                              </span>
                            )}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
