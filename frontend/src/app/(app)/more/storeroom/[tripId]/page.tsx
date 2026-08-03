'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCartons, bulkCreateCartons, deleteCarton } from '@/lib/cartonApi';
import type { CartonSummary } from '@/types/carton';
import { useLanguage } from '@/i18n/LanguageContext';

const STATUS_COLOR: Record<string, string> = {
  SEALED:  'bg-blue-100 text-blue-700',
  OPENED:  'bg-yellow-100 text-yellow-700',
  PARTIAL: 'bg-orange-100 text-orange-700',
  DONE:    'bg-green-100 text-green-700',
};

export default function TripCartonsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<'auto' | 'manual'>('auto');
  const [count, setCount] = useState('');
  const [location, setLocation] = useState('');
  const [manualNos, setManualNos] = useState(''); // comma-separated

  const { data: cartons = [], isLoading } = useQuery({
    queryKey: ['cartons', tripId],
    queryFn: () => getCartons({ tripId }),
  });

  const addMutation = useMutation({
    mutationFn: () => {
      const customNos = addMode === 'manual'
        ? manualNos.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
      return bulkCreateCartons({
        tripId,
        count: addMode === 'auto' ? parseInt(count) || 1 : (customNos?.length ?? 1),
        locationPrefix: location || undefined,
        customNos,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartons', tripId] });
      qc.invalidateQueries({ queryKey: ['trips-with-cartons'] });
      qc.invalidateQueries({ queryKey: ['storeroom-summary'] });
      setShowAdd(false);
      setCount('');
      setLocation('');
      setManualNos('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCarton(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartons', tripId] });
      qc.invalidateQueries({ queryKey: ['trips-with-cartons'] });
      qc.invalidateQueries({ queryKey: ['storeroom-summary'] });
    },
  });

  const total   = cartons.length;
  const sealed  = cartons.filter(c => c.status === 'SEALED').length;
  const inProg  = cartons.filter(c => c.status === 'OPENED' || c.status === 'PARTIAL').length;
  const done    = cartons.filter(c => c.status === 'DONE').length;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('storeroom.cartons')}</h1>
        <button onClick={() => setShowAdd(true)}
          className="text-sm font-semibold text-indigo-600">
          + {t('storeroom.addCartons')}
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-4 pt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{total} {t('storeroom.cartons')} · {sealed} {t('storeroom.sealed')} · {inProg} {t('storeroom.inProgress')} · {done} {t('storeroom.done')}</span>
            <span>{total > 0 ? Math.round(done / total * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${total > 0 ? done / total * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Carton list */}
      <div className="px-4 pt-4 space-y-2">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : cartons.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400">{t('storeroom.noCartonsYet')}</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-3 text-sm font-semibold text-indigo-600">
              + {t('storeroom.addCartons')}
            </button>
          </div>
        ) : (
          cartons.map(c => (
            <CartonCard key={c.id} carton={c} t={t}
              onDelete={() => { if (confirm(t('storeroom.confirmDelete'))) deleteMutation.mutate(c.id); }} />
          ))
        )}
      </div>

      {/* Add cartons slide panel */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-3xl px-4 pt-4 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{t('storeroom.addCartons')}</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-lg">✕</button>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {(['auto', 'manual'] as const).map(m => (
                <button key={m} onClick={() => setAddMode(m)}
                  className={`flex-1 py-2.5 text-sm font-medium transition ${addMode === m ? 'bg-indigo-600 text-white' : 'text-gray-600'}`}>
                  {t(`storeroom.mode_${m}`)}
                </button>
              ))}
            </div>

            {addMode === 'auto' ? (
              <div className="space-y-3">
                <input type="number" inputMode="numeric" min="0" placeholder={t('storeroom.countPlaceholder')}
                  value={count} onChange={e => setCount(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <p className="text-xs text-gray-400">{t('storeroom.autoNoteHint')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea placeholder={t('storeroom.manualNosPlaceholder')}
                  value={manualNos} onChange={e => setManualNos(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <p className="text-xs text-gray-400">{t('storeroom.manualNoteHint')}</p>
              </div>
            )}

            <input placeholder={t('storeroom.locationPlaceholder')} value={location} onChange={e => setLocation(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />

            <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40">
              {addMutation.isPending ? t('common.saving') : t('storeroom.addCartons')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CartonCard({ carton, t, onDelete }: { carton: CartonSummary; t: (k: string) => string; onDelete: () => void }) {
  const remaining = carton.totalQtyInCarton - carton.totalLabeled - carton.totalDamaged;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <Link href={`/more/storeroom/cartons/${carton.id}`} className="block px-4 py-3 active:bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{carton.cartonNo}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[carton.status]}`}>{carton.status}</span>
          </div>
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {carton.location && <p className="text-xs text-gray-400 mt-0.5">📍 {carton.location}</p>}

        {carton.status !== 'SEALED' && (
          <div className="mt-2 flex gap-3 text-xs text-gray-500">
            <span>{carton.totalQtyInCarton} {t('storeroom.pcs')}</span>
            <span className="text-green-600">✓ {carton.totalLabeled} {t('storeroom.labeled')}</span>
            {carton.totalDamaged > 0 && <span className="text-red-500">⚠ {carton.totalDamaged} {t('storeroom.damaged')}</span>}
            {remaining > 0 && <span className="text-orange-500">{remaining} {t('storeroom.remaining')}</span>}
          </div>
        )}
      </Link>
      {carton.status === 'SEALED' && (
        <div className="border-t border-gray-50 px-4 py-2 flex justify-end">
          <button onClick={onDelete} className="text-xs text-red-400">{t('common.delete')}</button>
        </div>
      )}
    </div>
  );
}
