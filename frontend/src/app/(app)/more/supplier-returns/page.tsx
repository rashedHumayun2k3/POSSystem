'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import SlidePanel from '@/components/ui/SlidePanel';
import SupplierPicker from '@/components/purchases/SupplierPicker';
import { listSupplierReturns, createSupplierReturn } from '@/lib/supplierReturnsApi';
import type { SupplierReturnStatus } from '@/types/supplierReturns';
import type { SupplierDto } from '@/types/supplier';
import { useLanguage } from '@/i18n/LanguageContext';
import { toastError } from '@/lib/toastError';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function SupplierReturnsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SupplierReturnStatus | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDto | null>(null);
  const [note, setNote] = useState('');

  const TABS: { labelKey: string; value: SupplierReturnStatus | '' }[] = [
    { labelKey: 'supplierReturns.tabAll',       value: '' },
    { labelKey: 'supplierReturns.tabDraft',     value: 'DRAFT' },
    { labelKey: 'supplierReturns.tabSubmitted', value: 'SUBMITTED' },
    { labelKey: 'supplierReturns.tabResolved',  value: 'RESOLVED' },
  ];

  const STATUS_LABELS: Record<string, string> = {
    DRAFT:     t('supplierReturns.statusDraft'),
    SUBMITTED: t('supplierReturns.statusSubmitted'),
    RESOLVED:  t('supplierReturns.statusResolved'),
    CANCELLED: t('supplierReturns.statusCancelled'),
  };

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['supplier-returns', activeTab],
    queryFn: () => listSupplierReturns(activeTab || undefined),
  });

  const resetCreateForm = () => {
    setShowCreate(false);
    setSelectedSupplier(null);
    setNote('');
  };

  const createMutation = useMutation({
    mutationFn: () => createSupplierReturn({ supplierId: selectedSupplier!.id, note: note.trim() || undefined }),
    onSuccess: (ret) => {
      qc.invalidateQueries({ queryKey: ['supplier-returns'] });
      resetCreateForm();
      router.push(`/more/supplier-returns/${ret.id}`);
    },
    onError: (err: unknown) => toastError(err, t('supplierReturns.failedCreate')),
  });

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
          <h1 className="flex-1 text-base font-semibold text-gray-900">{t('supplierReturns.title')}</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 text-sm font-semibold text-indigo-600"
          >
            <PlusIcon className="w-4 h-4" /> {t('supplierReturns.newReturn')}
          </button>
        </div>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition ${
                activeTab === tab.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-3 space-y-1.5">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)
        ) : returns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">{t('supplierReturns.noReturns')}</p>
        ) : (
          returns.map((ret) => {
            const date = new Date(ret.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
            return (
              <Link
                key={ret.id}
                href={`/more/supplier-returns/${ret.id}`}
                className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2.5 active:scale-[0.99] transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{ret.supplierReturnNo}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none ${STATUS_COLORS[ret.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[ret.status] ?? ret.status}
                    </span>
                    <span className="ml-auto text-[11px] text-gray-400 shrink-0">{date}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {ret.supplierName}
                    {' · '}{ret.itemCount} {ret.itemCount !== 1 ? t('supplierReturns.items') : t('supplierReturns.item')}
                    {' · '}৳{ret.totalValue.toLocaleString()}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })
        )}
      </div>

      {/* New return */}
      <SlidePanel
        open={showCreate}
        onClose={resetCreateForm}
        title={t('supplierReturns.newReturn')}
        footer={
          <button
            onClick={() => createMutation.mutate()}
            disabled={!selectedSupplier || createMutation.isPending}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {createMutation.isPending ? t('common.creating') : t('common.create')}
          </button>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('supplierReturns.supplier')}</label>
            <button
              type="button"
              onClick={() => setShowSupplierPicker(true)}
              className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-left"
            >
              <span className={selectedSupplier ? 'text-gray-900' : 'text-gray-400'}>
                {selectedSupplier?.name ?? t('pickers.chooseSupplier')}
              </span>
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('supplierReturns.note')}</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder={t('supplierReturns.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </SlidePanel>

      <SupplierPicker
        open={showSupplierPicker}
        onClose={() => setShowSupplierPicker(false)}
        onSelect={setSelectedSupplier}
        selectedId={selectedSupplier?.id}
      />
    </div>
  );
}
