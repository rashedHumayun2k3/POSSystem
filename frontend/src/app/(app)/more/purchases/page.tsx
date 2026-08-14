'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listTrips } from '@/lib/purchasesApi';
import type { TripStatus } from '@/types/purchases';
import { useLanguage } from '@/i18n/LanguageContext';
import { PurchaseProcessGuide } from '@/components/purchases/PurchaseProgress';

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

export default function PurchasesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'INCOMPLETE' | 'COMPLETED'>('INCOMPLETE');
  const { t } = useLanguage();

  const TABS: { labelKey: string; value: 'INCOMPLETE' | 'COMPLETED' }[] = [
    { labelKey: 'purchases.tabIncomplete', value: 'INCOMPLETE' },
    { labelKey: 'purchases.tabCompleted',  value: 'COMPLETED' },
  ];

  const SOURCE_LABELS: Record<string, string> = {
    CHINA_TRIP:      t('purchases.sourceChinaTrip'),
    ONLINE_WHOLESALE: t('purchases.sourceOnlineWholesale'),
    ALIBABA:         t('purchases.sourceOnlineWholesale'),
    LOCAL_WHOLESALE: t('purchases.sourceLocalWholesale'),
    AGENT:           t('purchases.sourceAgent'),
    FACTORY_DIRECT: t('purchases.sourceFactoryDirect'),
    IMPORTER_DISTRIBUTOR: t('purchases.sourceImporterDistributor'),
    SOCIAL_SUPPLIER: t('purchases.sourceSocialSupplier'),
    EXISTING_SUPPLIER_REORDER: t('purchases.sourceExistingSupplierReorder'),
  };

  const STATUS_LABELS: Record<string, string> = {
    DRAFT:            t('purchases.statusDraft'),
    PENDING_APPROVAL: t('purchases.statusPending'),
    RECEIVING:        t('purchases.statusReceiving'),
    COMPLETED:        t('purchases.statusCompleted'),
    CANCELLED:        t('purchases.statusCancelled'),
  };

  const RETURN_STATUS_LABELS: Record<string, string> = {
    DRAFT:     t('supplierReturns.statusDraft'),
    SUBMITTED: t('supplierReturns.statusSubmitted'),
    RESOLVED:  t('supplierReturns.statusResolved'),
    CANCELLED: t('supplierReturns.statusCancelled'),
  };

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['purchase-trips'],
    queryFn: () => listTrips(),
  });

  const visibleTrips = trips.filter((trip) =>
    activeTab === 'COMPLETED' ? trip.status === 'COMPLETED' : trip.status !== 'COMPLETED'
  );

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 text-base font-semibold text-gray-900">{t('purchases.title')}</h1>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition ${
                activeTab === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-3">
        <PurchaseProcessGuide activeStep={activeTab === 'COMPLETED' ? 'COMPLETED' : 'DRAFT'} t={t} />
      </div>
      <div className="px-4 pt-3 space-y-1.5">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))
        ) : visibleTrips.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t('purchases.noOrders')}</p>
        ) : (
          visibleTrips.map((trip) => {
            const date = new Date(trip.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
            const cost = (trip.totalItemCost + trip.totalSharedCost).toLocaleString();
            return (
              <Link
                key={trip.id}
                href={`/more/purchases/${trip.id}`}
                className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2.5 active:scale-[0.99] transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{trip.tripNo}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${STATUS_COLORS[trip.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[trip.status] ?? trip.status}
                    </span>
                    <span className="ml-auto text-[11px] text-gray-400 shrink-0">{date}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {SOURCE_LABELS[trip.sourceType] ?? trip.sourceType}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-gray-500">
                    <span className="flex items-center gap-0.5">📦 {trip.itemCount}</span>
                    <span className="flex items-center gap-0.5">💰 ৳{cost}</span>
                    <span className="flex items-center gap-0.5">🚚 {formatQty(trip.totalQtyUsable)}/{formatQty(trip.totalQtyBought)}</span>
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
          })
        )}
      </div>

      {/* FAB — wrapped in a full-width-up-to-768px centered strip so the button anchors to the
          app shell's own right edge instead of the browser viewport's, which on screens wider
          than the shell (max-w-[768px]) would otherwise leave it floating outside the layout. */}
      <div className="fixed bottom-20 inset-x-0 max-w-[768px] mx-auto pointer-events-none">
        <Link
          href="/more/purchases/new"
          className="pointer-events-auto absolute bottom-0 right-4 flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-full shadow-lg text-sm font-semibold active:scale-95 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('purchases.newOrder')}
        </Link>
      </div>
    </div>
  );
}
