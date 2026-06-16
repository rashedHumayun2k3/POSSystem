'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getUnits, createProduct } from '@/lib/catalogApi';
import type { Category, CategoryField } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';

const UNITS_FALLBACK = [
  { code: 'pcs', name: 'Pieces' },
  { code: 'pair', name: 'Pair' },
  { code: 'set', name: 'Set' },
  { code: 'dozen', name: 'Dozen' },
  { code: 'kg', name: 'Kilogram' },
  { code: 'gm', name: 'Gram' },
  { code: 'liter', name: 'Liter' },
  { code: 'ml', name: 'Milliliter' },
  { code: 'meter', name: 'Meter' },
  { code: 'box', name: 'Box' },
];

export default function NewProductPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    categoryId: '',
    name: '',
    unitCode: 'pcs',
    sellingPrice: '',
    marketPrice: '',
    packagingCostPerUnit: '0',
    lowStockThreshold: '5',
    description: '',
    note: '',
    attributesJson: '{}',
  });

  const [variantCombinations, setVariantCombinations] = useState<Record<string, string>[]>([{}]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const { data: units = UNITS_FALLBACK } = useQuery({ queryKey: ['units'], queryFn: getUnits });

  useEffect(() => {
    const cat = categories.find((c) => c.id === form.categoryId) ?? null;
    setSelectedCategory(cat);
    if (cat) {
      setForm((f) => ({ ...f, unitCode: cat.defaultUnit ?? 'pcs' }));
      const variantFields = cat.fields.filter((f) => f.isVariant);
      if (variantFields.length > 0) {
        setVariantCombinations([Object.fromEntries(variantFields.map((f) => [f.name, '']))]);
      } else {
        setVariantCombinations([{}]);
      }
    }
  }, [form.categoryId, categories]);

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      router.push(`/products/${product.id}`);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? t('products.failedCreate'));
    },
  });

  const variantFields = selectedCategory?.fields.filter((f) => f.isVariant) ?? [];
  const nonVariantFields = selectedCategory?.fields.filter((f) => !f.isVariant) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.categoryId) { setError(t('products.categoryRequired')); return; }
    if (!form.name.trim()) { setError(t('products.nameRequired')); return; }

    mutation.mutate({
      categoryId: form.categoryId,
      name: form.name.trim(),
      unitCode: form.unitCode,
      sellingPrice: parseFloat(form.sellingPrice),
      marketPrice: form.marketPrice ? parseFloat(form.marketPrice) : null,
      packagingCostPerUnit: parseFloat(form.packagingCostPerUnit) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 5,
      description: form.description || null,
      note: form.note || null,
      variantCombinations: variantCombinations.filter((c) => Object.values(c).some((v) => v.trim())),
    });
  };

  const addVariantRow = () => {
    setVariantCombinations([...variantCombinations, Object.fromEntries(variantFields.map((f) => [f.name, '']))]);
  };

  const updateVariantField = (rowIdx: number, fieldName: string, value: string) => {
    setVariantCombinations((prev) =>
      prev.map((row, i) => (i === rowIdx ? { ...row, [fieldName]: value } : row))
    );
  };

  const removeVariantRow = (idx: number) => {
    setVariantCombinations((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t('products.newTitle')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pt-4 space-y-4">
        {/* Category */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.categoryLabel')}</label>
          <select
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            required
          >
            <option value="">{t('products.selectCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.nameLabel')}</label>
          <input
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            placeholder={t('products.namePlaceholder')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        {/* Unit + Selling Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.unitLabel')}</label>
            <select
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={form.unitCode}
              onChange={(e) => setForm((f) => ({ ...f, unitCode: e.target.value }))}
            >
              {units.map((u) => (
                <option key={u.code} value={u.code}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.sellingPriceLabel')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder="0.00"
              value={form.sellingPrice}
              onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))}
              required
            />
          </div>
        </div>

        {/* Market Price + Packaging Cost */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.marketPriceLabel')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder={t('products.optional')}
              value={form.marketPrice}
              onChange={(e) => setForm((f) => ({ ...f, marketPrice: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.packagingCostLabel')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder="0.00"
              value={form.packagingCostPerUnit}
              onChange={(e) => setForm((f) => ({ ...f, packagingCostPerUnit: e.target.value }))}
            />
          </div>
        </div>

        {/* Low stock threshold */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.lowStockLabel')}</label>
          <input
            type="number"
            min="0"
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={form.lowStockThreshold}
            onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
          />
        </div>

        {/* Non-variant custom fields */}
        {nonVariantFields.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.attributesLabel')}</label>
            <div className="mt-1 space-y-2">
              {nonVariantFields.map((field) => (
                <CategoryFieldInput
                  key={field.id}
                  field={field}
                  value=""
                  onChange={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Variant combinations */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {t('products.variantRowsLabel')} {variantFields.length === 0 && t('products.variantsAutoDefault')}
            </label>
            {variantFields.length > 0 && (
              <button
                type="button"
                onClick={addVariantRow}
                className="text-xs text-indigo-600 font-medium"
              >
                {t('products.addRow')}
              </button>
            )}
          </div>
          {variantFields.length > 0 && (
            <div className="mt-2 space-y-2">
              {variantCombinations.map((combo, rowIdx) => (
                <div key={rowIdx} className="flex gap-2 items-center">
                  {variantFields.map((field) => (
                    <div key={field.id} className="flex-1">
                      <VariantFieldInput
                        field={field}
                        value={combo[field.name] ?? ''}
                        onChange={(v) => updateVariantField(rowIdx, field.name, v)}
                      />
                    </div>
                  ))}
                  {variantCombinations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariantRow(rowIdx)}
                      className="text-red-400 shrink-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.descriptionLabel')}</label>
          <textarea
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
            rows={2}
            placeholder={t('products.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
      </form>

      {/* Submit bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[768px] bg-white border-t border-gray-100 px-4 py-3">
        <button
          onClick={handleSubmit as React.MouseEventHandler}
          disabled={mutation.isPending}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
        >
          {mutation.isPending ? t('common.creating') : t('products.createBtn')}
        </button>
      </div>
    </div>
  );
}

// ── Helper inputs ─────────────────────────────────────────────────────────────

function VariantFieldInput({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = field.optionsJson ? (JSON.parse(field.optionsJson) as string[]) : [];

  if (field.fieldType === 'DROPDOWN') {
    return (
      <select
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{field.name}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
      placeholder={field.name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CategoryFieldInput({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = field.optionsJson ? (JSON.parse(field.optionsJson) as string[]) : [];

  if (field.fieldType === 'DROPDOWN') {
    return (
      <select
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{field.name}…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
      placeholder={field.name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
