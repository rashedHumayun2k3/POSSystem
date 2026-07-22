'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { getCategory, getCategories, updateCategory, addCategoryField, updateCategoryField, deleteCategoryField } from '@/lib/catalogApi';
import type { CategoryField } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';
import { categoryDisplayName, parentCategoryDisplayName } from '@/lib/categoryDisplay';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'BOOLEAN'] as const;

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, lang } = useLanguage();

  const [editName, setEditName] = useState('');
  const [editNameBn, setEditNameBn] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editParentId, setEditParentId] = useState('');
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldForm, setFieldForm] = useState<Partial<CategoryField>>({
    name: '', fieldType: 'TEXT', isRequired: false, isVariant: false, isPerLot: false, sortOrder: 0,
  });
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const { data: category, isLoading } = useQuery({
    queryKey: ['category', id],
    queryFn: () => getCategory(id),
  });

  const { data: allCategories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const topLevelCategories = allCategories.filter((c) => !c.parentCategoryId && c.id !== id);
  const hasSubcategories = allCategories.some((c) => c.parentCategoryId === id);

  useEffect(() => {
    if (category) {
      setEditName(category.name);
      setEditNameBn(category.nameBn ?? '');
      setEditUnit(category.defaultUnit ?? 'pcs');
      setEditParentId(category.parentCategoryId ?? '');
    }
  }, [category]);

  const updateMeta = useMutation({
    mutationFn: () => updateCategory(id, { name: editName, nameBn: editNameBn.trim() || null, defaultUnit: editUnit, parentCategoryId: editParentId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category', id] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      useToastStore.getState().show(t('common.saved'));
    },
    onError: (err: unknown) => toastError(err, t('categories.failedUpdate')),
  });

  const addFieldMutation = useMutation({
    mutationFn: (payload: Omit<CategoryField, 'id'>) => addCategoryField(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category', id] });
      setShowFieldForm(false);
      setFieldForm({ name: '', fieldType: 'TEXT', isRequired: false, isVariant: false, isPerLot: false, sortOrder: 0 });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: ({ fieldId, payload }: { fieldId: string; payload: Omit<CategoryField, 'id'> }) =>
      updateCategoryField(id, fieldId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category', id] });
      setEditingFieldId(null);
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId: string) => deleteCategoryField(id, fieldId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['category', id] }),
  });

  if (isLoading || !category) {
    return <div className="px-4 pt-8 text-gray-400 text-sm">{t('common.loading')}</div>;
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900">{categoryDisplayName(category, lang)}</h1>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Name / Bangla name / unit / parent — always editable, no extra click needed */}
        <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
            <input
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t('categories.categoryName')}
            />
            <input
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              value={editNameBn}
              onChange={(e) => setEditNameBn(e.target.value)}
              placeholder={t('categories.namePlaceholderBn')}
            />
            <select
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
            >
              {['pcs', 'pair', 'set', 'dozen', 'kg', 'gm', 'liter', 'ml', 'meter', 'box'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            {!hasSubcategories && (
              <select
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={editParentId}
                onChange={(e) => setEditParentId(e.target.value)}
              >
                <option value="">{t('categories.noneTopLevel')}</option>
                {topLevelCategories.map((c) => (
                  <option key={c.id} value={c.id}>{categoryDisplayName(c, lang)}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => updateMeta.mutate()}
              disabled={updateMeta.isPending}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {updateMeta.isPending ? t('common.saving') : t('categories.saveChanges')}
            </button>
        </div>

        {/* Fields section — subcategories always use their parent's fields, so there's nothing
            to manage here; send staff to the parent instead of showing a dead-end editor. */}
        {category.parentCategoryId ? (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600">
            {t('categories.inheritsFields')} — {parentCategoryDisplayName(category, lang)}.{' '}
            <Link href={`/more/categories/${category.parentCategoryId}`} className="text-indigo-600 font-medium">
              {t('common.edit')}
            </Link>
          </div>
        ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">{t('categories.customFields')}</p>
            <button
              onClick={() => { setShowFieldForm(!showFieldForm); setEditingFieldId(null); }}
              className="text-xs text-indigo-600 font-medium"
            >
              {showFieldForm ? t('common.cancel') : t('categories.addField')}
            </button>
          </div>

          {/* Add / Edit field form */}
          {(showFieldForm || editingFieldId) && (
            <FieldForm
              form={fieldForm}
              setForm={setFieldForm}
              onSubmit={() => {
                const payload = {
                  name: fieldForm.name ?? '',
                  fieldType: fieldForm.fieldType ?? 'TEXT',
                  optionsJson: fieldForm.optionsJson ?? null,
                  isRequired: fieldForm.isRequired ?? false,
                  isVariant: fieldForm.isVariant ?? false,
                  isPerLot: fieldForm.isPerLot ?? false,
                  sortOrder: fieldForm.sortOrder ?? 0,
                };
                if (editingFieldId) {
                  updateFieldMutation.mutate({ fieldId: editingFieldId, payload });
                } else {
                  addFieldMutation.mutate(payload);
                }
              }}
              isPending={addFieldMutation.isPending || updateFieldMutation.isPending}
              isEdit={!!editingFieldId}
              t={t}
            />
          )}

          {/* Field list */}
          <div className="space-y-2 mt-2">
            {category.fields.map((field) => (
              <div key={field.id} className="bg-white border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{field.name}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {field.fieldType}
                      </span>
                      {field.isRequired && (
                        <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{t('common.required')}</span>
                      )}
                      {field.isVariant && (
                        <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{t('categories.splitsStock')}</span>
                      )}
                      {field.isPerLot && (
                        <span className="text-xs bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded">{t('categories.perLot')}</span>
                      )}
                    </div>
                    {field.optionsJson && (
                      <p className="text-xs text-gray-400 mt-1">
                        {t('categories.options')}: {(JSON.parse(field.optionsJson) as string[]).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setFieldForm(field);
                        setEditingFieldId(field.id);
                        setShowFieldForm(false);
                      }}
                      className="text-xs text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t('categories.deleteField', { name: field.name }))) {
                          deleteFieldMutation.mutate(field.id);
                        }
                      }}
                      className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded-lg"
                    >
                      Del
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {category.fields.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">{t('categories.noFields')}</p>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function FieldForm({
  form,
  setForm,
  onSubmit,
  isPending,
  isEdit,
  t,
}: {
  form: Partial<CategoryField>;
  setForm: (f: Partial<CategoryField>) => void;
  onSubmit: () => void;
  isPending: boolean;
  isEdit: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="bg-indigo-50 rounded-xl p-4 space-y-3 mb-3">
      <input
        className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
        placeholder={t('categories.fieldNamePlaceholder')}
        value={form.name ?? ''}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <select
        className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
        value={form.fieldType ?? 'TEXT'}
        onChange={(e) => setForm({ ...form, fieldType: e.target.value as any })}
      >
        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {form.fieldType === 'DROPDOWN' && (
        <textarea
          className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white resize-none"
          rows={2}
          placeholder={t('categories.optionsPlaceholder')}
          value={form.optionsJson ?? ''}
          onChange={(e) => setForm({ ...form, optionsJson: e.target.value })}
        />
      )}
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isRequired ?? false}
            onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
          />
          {t('common.required')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isVariant ?? false}
            onChange={(e) => setForm({ ...form, isVariant: e.target.checked })}
          />
          {t('categories.splitsStock')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isPerLot ?? false}
            onChange={(e) => setForm({ ...form, isPerLot: e.target.checked })}
          />
          {t('categories.perLot')}
        </label>
      </div>
      <button
        onClick={onSubmit}
        disabled={isPending}
        className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
      >
        {isPending ? t('common.saving') : isEdit ? t('categories.updateField') : t('categories.addFieldBtn')}
      </button>
    </div>
  );
}
