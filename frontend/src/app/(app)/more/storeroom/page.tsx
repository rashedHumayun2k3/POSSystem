'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoreroomSummary, getTripsWithCartons, getCartons, getDamagedItems } from '@/lib/cartonApi';
import { searchProducts } from '@/lib/catalogApi';
import { locationLookup } from '@/lib/cartonApi';
import type { CartonSummary, LocationLookupItem, DamagedItem, TripWithCartons } from '@/types/carton';
import type { ProductSearchResult } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';

type Tab = 'trips' | 'all' | 'damaged';

const STATUS_COLOR: Record<string, string> = {
  SEALED:  'bg-blue-100 text-blue-700',
  OPENED:  'bg-yellow-100 text-yellow-700',
  PARTIAL: 'bg-orange-100 text-orange-700',
  DONE:    'bg-green-100 text-green-700',
};

export default function StoreroomPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('trips');
  const [searchVariantId, setSearchVariantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState<LocationLookupItem[] | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: summary } = useQuery({ queryKey: ['storeroom-summary'], queryFn: getStoreroomSummary });
  const { data: trips = [] } = useQuery({ queryKey: ['trips-with-cartons'], queryFn: getTripsWithCartons });
  const { data: allCartons = [] } = useQuery({ queryKey: ['cartons-all'], queryFn: () => getCartons(), enabled: tab === 'all' });
  const { data: damaged = [] } = useQuery({ queryKey: ['damaged-items'], queryFn: getDamagedItems, enabled: tab === 'damaged' });

  function handleSearchInput(q: string) {
    setSearchQuery(q);
    setSearchVariantId('');
    setLookupResults(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setProductResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setProductSearchLoading(true);
      try {
        setProductResults(await searchProducts(q));
      } finally {
        setProductSearchLoading(false);
      }
    }, 300);
  }

  async function handleLocationSearch(variantId: string, productName: string) {
    setSearchVariantId(variantId);
    setSearchQuery(productName);
    setProductResults([]);
    setLookupLoading(true);
    setLookupResults(null);
    try {
      const res = await locationLookup(variantId);
      setLookupResults(res);
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('storeroom.title')}</h1>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="px-4 pt-4 grid grid-cols-4 gap-2">
          {[
            { label: t('storeroom.sealed'),  value: summary.sealed,  color: 'bg-blue-50 text-blue-700' },
            { label: t('storeroom.opened'),  value: summary.opened + summary.partial, color: 'bg-yellow-50 text-yellow-700' },
            { label: t('storeroom.done'),    value: summary.done,    color: 'bg-green-50 text-green-700' },
            { label: t('storeroom.damaged'), value: summary.totalDamaged, color: 'bg-red-50 text-red-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[10px] font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Location search */}
      <div className="px-4 pt-4">
        <p className="text-xs font-semibold text-gray-500 mb-1.5">{t('storeroom.findProduct')}</p>
        <div className="relative">
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setLookupResults(null); setSearchVariantId(''); }}
            placeholder={t('storeroom.searchPlaceholder')}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {searchQuery && !searchVariantId && productResults.length > 0 && (
            <div className="absolute z-20 top-11 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {productResults.slice(0, 8).map(p => (
                <button key={p.variantId} onClick={() => handleLocationSearch(p.variantId, p.productName)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  {p.productName}
                </button>
              ))}
            </div>
          )}
        </div>

        {lookupLoading && <p className="text-xs text-gray-400 mt-2">{t('common.loading')}...</p>}

        {lookupResults !== null && (
          <div className="mt-2 space-y-2">
            {lookupResults.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">{t('storeroom.notInAnyCarton')}</p>
            ) : (
              lookupResults.map(r => (
                <Link key={r.cartonId} href={`/more/storeroom/cartons/${r.cartonId}`}
                  className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.cartonNo}
                      <span className="ml-2 text-xs text-gray-500">Trip {r.tripNo}</span>
                    </p>
                    <p className="text-xs text-gray-500">{r.location || t('storeroom.noLocation')}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{r.qtyInCarton} {t('storeroom.pcs')} · {r.qtyLabeled} {t('storeroom.labeled')}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-4 gap-1 border-b border-gray-100">
        {(['trips', 'all', 'damaged'] as Tab[]).map(t2 => (
          <button key={t2} onClick={() => setTab(t2)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition ${tab === t2 ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>
            {t(`storeroom.tab_${t2}`)}
          </button>
        ))}
      </div>

      {/* Tab: Trips */}
      {tab === 'trips' && (
        <div className="px-4 pt-3 space-y-2">
          {trips.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">{t('storeroom.noCartons')}</p>
          ) : (
            trips.map(trip => <TripCard key={trip.tripId} trip={trip} t={t} />)
          )}
        </div>
      )}

      {/* Tab: All cartons */}
      {tab === 'all' && (
        <div className="px-4 pt-3 space-y-2">
          {allCartons.map(c => <CartonRow key={c.id} carton={c} t={t} />)}
        </div>
      )}

      {/* Tab: Damaged */}
      {tab === 'damaged' && (
        <div className="px-4 pt-3 space-y-2">
          {damaged.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">{t('storeroom.noDamaged')}</p>
          ) : (
            damaged.map((d, i) => <DamagedRow key={i} item={d} t={t} />)
          )}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip, t }: { trip: TripWithCartons; t: (k: string) => string }) {
  const progress = trip.cartonCount > 0 ? Math.round((trip.doneCount / trip.cartonCount) * 100) : 0;
  return (
    <Link href={`/more/storeroom/${trip.tripId}`}
      className="block bg-white border border-gray-100 rounded-2xl px-4 py-3 active:bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{trip.tripNo}</p>
          <p className="text-xs text-gray-400 mt-0.5">{trip.cartonCount} {t('storeroom.cartons')} · {trip.sealedCount} {t('storeroom.sealed')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-indigo-600">{progress}%</p>
          <p className="text-[10px] text-gray-400">{t('storeroom.done')}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}

function CartonRow({ carton, t }: { carton: CartonSummary; t: (k: string) => string }) {
  return (
    <Link href={`/more/storeroom/cartons/${carton.id}`}
      className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 active:bg-gray-50">
      <div>
        <p className="text-sm font-semibold text-gray-900">{carton.cartonNo}
          <span className="ml-2 text-xs text-gray-400">{carton.tripNo}</span>
        </p>
        <p className="text-xs text-gray-400">{carton.location || t('storeroom.noLocation')}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[carton.status]}`}>{carton.status}</span>
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function DamagedRow({ item, t }: { item: DamagedItem; t: (k: string) => string }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
          <p className="text-xs text-gray-500">{item.variantSku} · {t('storeroom.carton')} {item.cartonNo} · {item.tripNo}</p>
        </div>
        <span className="text-sm font-bold text-red-600">{item.qtyDamaged} {t('storeroom.pcs')}</span>
      </div>
      {item.openedAt && (
        <p className="text-[10px] text-gray-400 mt-1">{new Date(item.openedAt).toLocaleDateString()}</p>
      )}
    </div>
  );
}
