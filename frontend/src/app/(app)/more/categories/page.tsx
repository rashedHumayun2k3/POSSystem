'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCategories, createCategory, deleteCategory } from '@/lib/catalogApi';
import CustomSelect from '@/components/ui/CustomSelect';
import { useLanguage } from '@/i18n/LanguageContext';
import { categoryDisplayName } from '@/lib/categoryDisplay';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';

export default function CategoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { t, lang } = useLanguage();
  const returnTo = searchParams.get('returnTo');
  const safeReturnTo = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null;
  const [showNew, setShowNew] = useState(() => searchParams.get('new') === '1');
  const [newName, setNewName] = useState('');
  const [newNameBn, setNewNameBn] = useState('');
  const [newUnit, setNewUnit] = useState('pcs');
  const [newParentId, setNewParentId] = useState('');

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setShowNew(false);
      setNewName('');
      setNewNameBn('');
      setNewUnit('pcs');
      setNewParentId('');
      if (safeReturnTo) router.push(safeReturnTo);
    },
    onError: (err: unknown) => toastError(err, t('categories.failedCreate')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (err: unknown) => toastError(err, t('categories.cannotDelete')),
  });

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{t('categories.title')}</h1>
        <button
          onClick={() => setShowNew(!showNew)}
          className="text-indigo-600 font-medium text-sm"
        >
          {showNew ? t('common.cancel') : t('categories.new')}
        </button>
      </div>

      {/* New category form */}
      {showNew && (
        <div className="mx-4 mt-3 bg-indigo-50 rounded-xl p-4 space-y-3">
          <input
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={t('categories.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={t('categories.namePlaceholderBn')}
            value={newNameBn}
            onChange={(e) => setNewNameBn(e.target.value)}
          />
          <div className="flex gap-2 items-center">
            <label className="text-xs text-indigo-700 shrink-0">{t('categories.defaultUnit')}</label>
            <div className="flex-1">
              <CustomSelect
                triggerClassName="w-full flex items-center justify-between gap-2 border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white text-left"
                value={newUnit}
                onChange={setNewUnit}
                options={['pcs', 'pair', 'set', 'dozen', 'kg', 'gm', 'liter', 'ml', 'meter', 'box'].map((u) => ({ value: u, label: u }))}
              />
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-xs text-indigo-700 shrink-0">{t('categories.parentCategory')}</label>
            <div className="flex-1">
              <CustomSelect
                triggerClassName="w-full flex items-center justify-between gap-2 border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white text-left"
                value={newParentId}
                onChange={setNewParentId}
                placeholder={t('categories.noneTopLevel')}
                options={[
                  { value: '', label: t('categories.noneTopLevel') },
                  ...categories.filter((c) => !c.parentCategoryId).map((c) => ({ value: c.id, label: categoryDisplayName(c, lang) })),
                ]}
              />
            </div>
          </div>
          <button
            onClick={() => {
              if (!newName.trim()) { useToastStore.getState().show(t('categories.nameRequired'), 'error'); return; }
              createMutation.mutate({ name: newName.trim(), nameBn: newNameBn.trim() || null, defaultUnit: newUnit, parentCategoryId: newParentId || null });
            }}
            disabled={createMutation.isPending}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {createMutation.isPending ? t('common.creating') : t('categories.createCategory')}
          </button>
        </div>
      )}

      {/* List — top-level categories with their subcategories nested underneath */}
      <div className="px-4 pt-3 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">{t('categories.noCategories')}</p>
        ) : (
          categories.filter((c) => !c.parentCategoryId).map((top) => {
            const subs = categories.filter((c) => c.parentCategoryId === top.id);
            return (
              <div key={top.id} className="space-y-2">
                <CategoryRow cat={top} t={t} lang={lang} onDelete={(id) => deleteMutation.mutate(id)} />
                {subs.map((sub) => (
                  <div key={sub.id} className="ml-5">
                    <CategoryRow cat={sub} t={t} lang={lang} onDelete={(id) => deleteMutation.mutate(id)} isSub />
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  cat,
  t,
  lang,
  onDelete,
  isSub,
}: {
  cat: { id: string; name: string; nameBn: string | null; fields: unknown[]; defaultUnit: string | null };
  t: (key: string, params?: Record<string, string>) => string;
  lang: string;
  onDelete: (id: string) => void;
  isSub?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <Link href={`/more/categories/${cat.id}`}>
          <p className="text-sm font-medium text-gray-900">{isSub && '— '}{categoryDisplayName(cat, lang)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isSub
              ? t('categories.inheritsFields')
              : `${cat.fields.length} ${cat.fields.length !== 1 ? t('categories.fields') : t('categories.field')} · ${t('categories.defaultUnitLabel')}: ${cat.defaultUnit ?? 'pcs'}`}
          </p>
        </Link>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link
          href={`/more/categories/${cat.id}`}
          className="text-xs text-indigo-600 font-medium border border-indigo-200 px-2 py-1 rounded-lg"
        >
          {t('common.edit')}
        </Link>
        <button
          onClick={() => {
            if (confirm(t('categories.deleteConfirm', { name: cat.name }))) {
              onDelete(cat.id);
            }
          }}
          className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded-lg"
        >
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}
