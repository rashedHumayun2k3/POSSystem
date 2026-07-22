'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getUnits, createProduct } from '@/lib/catalogApi';
import type { Category, CategoryField } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';
import ImageUploadField from '@/components/ui/ImageUploadField';
import { categoryDisplayName } from '@/lib/categoryDisplay';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';

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
  const { t, lang } = useLanguage();

  const [form, setForm] = useState({
    categoryId: '',
    name: '',
    imageUrl: null as string | null,
    unitCode: 'pcs',
    sellingPrice: '',
    marketPrice: '',
    packagingCostPerUnit: '0',
    lowStockThreshold: '5',
    description: '',
    note: '',
    attributesJson: '{}',
    initialStock: '',
    costPrice: '',
    warrantyDurationValue: '',
    warrantyDurationUnit: 'MONTHS',
  });

  const [variantCombinations, setVariantCombinations] = useState<Record<string, string>[]>([{}]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showMarketPrice, setShowMarketPrice] = useState(false);

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
    onError: (err: unknown) => toastError(err, t('products.failedCreate')),
  });

  const variantFields = selectedCategory?.fields.filter((f) => f.isVariant) ?? [];
  const nonVariantFields = selectedCategory?.fields.filter((f) => !f.isVariant) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) { useToastStore.getState().show(t('products.categoryRequired'), 'error'); return; }
    if (!form.name.trim()) { useToastStore.getState().show(t('products.nameRequired'), 'error'); return; }
    if (!form.imageUrl) { useToastStore.getState().show(t('products.imageRequired'), 'error'); return; }

    mutation.mutate({
      categoryId: form.categoryId,
      name: form.name.trim(),
      imageUrl: form.imageUrl,
      unitCode: form.unitCode,
      sellingPrice: parseFloat(form.sellingPrice),
      marketPrice: form.marketPrice ? parseFloat(form.marketPrice) : null,
      packagingCostPerUnit: parseFloat(form.packagingCostPerUnit) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 5,
      description: form.description || null,
      note: form.note || null,
      variantCombinations: variantCombinations.filter((c) => Object.values(c).some((v) => v.trim())),
      initialStock: variantCombinations.length === 1 && form.initialStock ? parseFloat(form.initialStock) : null,
      costPrice: variantCombinations.length === 1 && form.costPrice ? parseFloat(form.costPrice) : null,
      warrantyDurationValue: form.warrantyDurationValue ? parseInt(form.warrantyDurationValue) : null,
      warrantyDurationUnit: form.warrantyDurationValue ? form.warrantyDurationUnit : null,
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
    <div className="pb-36">
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
            {categories.filter((c) => !c.parentCategoryId).map((top) => {
              const subs = categories.filter((c) => c.parentCategoryId === top.id);
              const topName = categoryDisplayName(top, lang);
              if (subs.length === 0) return <option key={top.id} value={top.id}>{topName}</option>;
              return (
                <optgroup key={top.id} label={topName}>
                  <option value={top.id}>{topName}</option>
                  {subs.map((sub) => (
                    <option key={sub.id} value={sub.id}>{'— '}{categoryDisplayName(sub, lang)}</option>
                  ))}
                </optgroup>
              );
            })}
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

        {/* Product photo */}
        <ImageUploadField
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          label={`${t('products.imageLabel')} *`}
          uploadingLabel={t('products.imageUploading')}
          errorLabel={t('products.imageUploadFailed')}
          removeLabel={t('products.imageRemove')}
        />

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

        {/* Packaging Cost */}
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

        {/* Market Price — hidden by default, only needed when advertising a discount */}
        {!showMarketPrice ? (
          <button
            type="button"
            onClick={() => setShowMarketPrice(true)}
            className="text-xs text-indigo-600 font-medium"
          >
            {t('products.addDiscountPrice')}
          </button>
        ) : (
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
            <p className="text-xs text-gray-400 mt-1">{t('products.marketPriceHint')}</p>
          </div>
        )}

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

        {/* Current stock + cost price — "I already own some of these", not a new purchase.
            Only meaningful for a single-variant product; hidden once more than one variant row
            exists, since a single quantity/cost can't be split across multiple variants here. */}
        {variantCombinations.length === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.initialStockLabel')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                placeholder={t('products.optional')}
                value={form.initialStock}
                onChange={(e) => setForm((f) => ({ ...f, initialStock: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.costPriceLabel')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                placeholder={t('products.optional')}
                value={form.costPrice}
                onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
              />
            </div>
            {form.initialStock && !form.costPrice && (
              <p className="col-span-2 text-xs text-amber-600">{t('products.costPriceHint')}</p>
            )}
          </div>
        )}

        {/* Warranty */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.warrantyLabel')}</label>
            <input
              type="number"
              min="0"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder={t('products.optional')}
              value={form.warrantyDurationValue}
              onChange={(e) => setForm((f) => ({ ...f, warrantyDurationValue: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">&nbsp;</label>
            <select
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={form.warrantyDurationUnit}
              onChange={(e) => setForm((f) => ({ ...f, warrantyDurationUnit: e.target.value }))}
            >
              <option value="DAYS">{t('products.warrantyDays')}</option>
              <option value="MONTHS">{t('products.warrantyMonths')}</option>
              <option value="YEARS">{t('products.warrantyYears')}</option>
            </select>
          </div>
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

      </form>

      {/* Submit bar — sits above the fixed bottom tab bar (h-16), not behind it */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[768px] z-50 bg-white border-t border-gray-100 px-4 py-3">
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
