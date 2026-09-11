'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getUnits, createProduct } from '@/lib/catalogApi';
import { listSuggestedProducts } from '@/lib/catalogTemplatesApi';
import { getAppSettings } from '@/lib/settingsApi';
import type { Category, CategoryField } from '@/types/catalog';
import type { SuggestedProduct } from '@/types/catalogTemplates';
import { useLanguage } from '@/i18n/LanguageContext';
import CustomSelect from '@/components/ui/CustomSelect';
import { categoryDisplayName } from '@/lib/categoryDisplay';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';
import { resolveMediaUrl } from '@/lib/media';
import { PlusIcon } from '@heroicons/react/24/outline';

type VariantRow = { values: Record<string, string>; qty: string; costPrice: string };

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
    lowStockThreshold: '5',
    description: '',
    note: '',
    attributesJson: '{}',
    warrantyDurationValue: '',
    warrantyDurationUnit: 'MONTHS',
  });

  const [variantCombinations, setVariantCombinations] = useState<VariantRow[]>([{ values: {}, qty: '', costPrice: '' }]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSuggestedProduct, setSelectedSuggestedProduct] = useState<SuggestedProduct | null>(null);
  const [nameFocused, setNameFocused] = useState(false);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const { data: units = UNITS_FALLBACK } = useQuery({ queryKey: ['units'], queryFn: getUnits });
  const { data: appSettings } = useQuery({ queryKey: ['app-settings'], queryFn: getAppSettings });
  const { data: suggestedProducts = [], isFetching: suggestedProductsLoading } = useQuery({
    queryKey: ['suggested-products', form.categoryId],
    queryFn: () => listSuggestedProducts(form.categoryId),
    enabled: !!form.categoryId,
  });

  // Pre-fills the low-stock threshold from the business's global default (Settings > Low Stock
  // Alert) instead of a hardcoded 5 — still fully editable per product before saving. Applied
  // once, whenever the setting first arrives, so it doesn't stomp on an in-progress edit later.
  const appliedLowStockDefault = useRef(false);
  useEffect(() => {
    if (appliedLowStockDefault.current || !appSettings) return;
    const def = appSettings.low_stock_default;
    if (def) {
      setForm((f) => ({ ...f, lowStockThreshold: def }));
    }
    appliedLowStockDefault.current = true;
  }, [appSettings]);

  useEffect(() => {
    const cat = categories.find((c) => c.id === form.categoryId) ?? null;
    setSelectedCategory(cat);
    if (cat) {
      setForm((f) => ({ ...f, unitCode: cat.defaultUnit ?? 'pcs' }));
      const variantFields = cat.fields.filter((f) => f.isVariant);
      if (variantFields.length > 0) {
        setVariantCombinations([{ values: Object.fromEntries(variantFields.map((f) => [f.name, ''])), qty: '', costPrice: '' }]);
      } else {
        setVariantCombinations([{ values: {}, qty: '', costPrice: '' }]);
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
  const normalizedNameQuery = form.name.trim().toLowerCase();
  const filteredSuggestedProducts = suggestedProducts
    .filter((product) => !normalizedNameQuery || product.name.toLowerCase().includes(normalizedNameQuery))
    .slice(0, 8);
  const showNameSuggestions = Boolean(
    form.categoryId
    && nameFocused
    && !selectedSuggestedProduct
    && (suggestedProductsLoading || filteredSuggestedProducts.length > 0)
  );

  const handleNameChange = (value: string) => {
    setSelectedSuggestedProduct(null);
    setForm((f) => ({ ...f, name: value }));
  };

  const selectSuggestedProduct = (product: SuggestedProduct) => {
    if (product.alreadyAdded) return;
    setSelectedSuggestedProduct(product);
    setForm((f) => ({
      ...f,
      name: product.name,
      imageUrl: f.imageUrl ?? product.imageUrl,
    }));
    setNameFocused(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) { useToastStore.getState().show(t('products.categoryRequired'), 'error'); return; }
    if (!form.name.trim()) { useToastStore.getState().show(t('products.nameRequired'), 'error'); return; }
    for (const row of variantCombinations) {
      if (!row.qty || parseFloat(row.qty) <= 0) { useToastStore.getState().show(t('products.stockValueRequired'), 'error'); return; }
      if (row.costPrice === '' || parseFloat(row.costPrice) < 0) { useToastStore.getState().show(t('products.costRequired'), 'error'); return; }
    }

    mutation.mutate({
      categoryId: form.categoryId,
      name: form.name.trim(),
      imageUrl: form.imageUrl,
      unitCode: form.unitCode,
      sellingPrice: parseFloat(form.sellingPrice),
      marketPrice: form.marketPrice ? parseFloat(form.marketPrice) : null,
      packagingCostPerUnit: 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 5,
      description: form.description || null,
      note: form.note || null,
      variantCombinations: variantCombinations.map((row) => ({
        values: row.values,
        qty: parseFloat(row.qty),
        costPrice: parseFloat(row.costPrice),
      })),
      warrantyDurationValue: form.warrantyDurationValue ? parseInt(form.warrantyDurationValue) : null,
      warrantyDurationUnit: form.warrantyDurationValue ? form.warrantyDurationUnit : null,
      wholesaleMinQty: null,
      wholesaleUnitPrice: null,
      wholesaleNote: null,
      suggestedProductId: selectedSuggestedProduct?.id ?? null,
    });
  };

  const addVariantRow = () => {
    setVariantCombinations([
      ...variantCombinations,
      { values: Object.fromEntries(variantFields.map((f) => [f.name, ''])), qty: '', costPrice: '' },
    ]);
  };

  const updateVariantField = (rowIdx: number, fieldName: string, value: string) => {
    setVariantCombinations((prev) =>
      prev.map((row, i) => (i === rowIdx ? { ...row, values: { ...row.values, [fieldName]: value } } : row))
    );
  };

  const updateVariantQty = (rowIdx: number, value: string) => {
    setVariantCombinations((prev) => prev.map((row, i) => (i === rowIdx ? { ...row, qty: value } : row)));
  };

  const updateVariantCost = (rowIdx: number, value: string) => {
    setVariantCombinations((prev) => prev.map((row, i) => (i === rowIdx ? { ...row, costPrice: value } : row)));
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
          <div className="mt-1">
            <CustomSelect
              value={form.categoryId}
              searchable
              searchPlaceholder={t('products.searchCategoryPlaceholder')}
              noResultsLabel={t('products.noCategoryMatches')}
              onChange={(v) => {
                setSelectedSuggestedProduct(null);
                setNameFocused(false);
                setForm((f) => ({ ...f, categoryId: v }));
              }}
              options={[
                { value: '', label: t('products.selectCategory') },
                ...categories.filter((c) => !c.parentCategoryId).flatMap((top) => {
                  const subs = categories.filter((c) => c.parentCategoryId === top.id);
                  const topName = categoryDisplayName(top, lang);
                  return [
                    { value: top.id, label: topName },
                    ...subs.map((sub) => ({ value: sub.id, label: `— ${categoryDisplayName(sub, lang)}` })),
                  ];
                }),
              ]}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">{t('products.categoryMissingHint')}</p>
            <button
              type="button"
              onClick={() => router.push(`/more/categories?new=1&returnTo=${encodeURIComponent('/products/new')}`)}
              className="shrink-0 text-xs font-semibold text-indigo-600"
            >
              {t('products.addCategoryAction')}
            </button>
          </div>
        </div>

        {form.categoryId ? (
          <>
        {/* Name */}
        <div className="relative">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.nameLabel')}</label>
          <input
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            placeholder={t('products.namePlaceholder')}
            value={form.name}
            onFocus={() => setNameFocused(true)}
            onBlur={() => window.setTimeout(() => setNameFocused(false), 120)}
            onChange={(e) => handleNameChange(e.target.value)}
            autoComplete="off"
            required
          />
          {showNameSuggestions && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {suggestedProductsLoading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                filteredSuggestedProducts.map((product) => {
                  const imageUrl = resolveMediaUrl(product.imageUrl);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={product.alreadyAdded}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestedProduct(product)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-indigo-50 disabled:hover:bg-white disabled:opacity-50"
                    >
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                        {imageUrl ? (
                          <Image src={imageUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" />
                        ) : (
                          <span className="block h-full w-full bg-gray-100" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{product.name}</span>
                        {product.alreadyAdded && (
                          <span className="text-[11px] text-gray-400">{t('catalogTemplates.alreadyAdded')}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
          {selectedSuggestedProduct && (
            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700">
              <span className="truncate">{t('products.suggestedProductSelected')}: {selectedSuggestedProduct.name}</span>
              <button
                type="button"
                onClick={() => setSelectedSuggestedProduct(null)}
                aria-label={t('products.clearSuggestedProduct')}
                className="shrink-0 text-indigo-400 hover:text-indigo-700"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Purchase price + selling price */}
        <div className={`grid gap-3 ${variantFields.length === 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {variantFields.length === 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.buyPrice')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                placeholder="0.00"
                value={variantCombinations[0]?.costPrice ?? ''}
                onChange={(e) => updateVariantCost(0, e.target.value)}
                required
              />
            </div>
          )}
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

        <div className={`grid gap-3 ${variantFields.length === 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.unitLabel')}</label>
            <div className="mt-1">
              <CustomSelect
                value={form.unitCode}
                onChange={(v) => setForm((f) => ({ ...f, unitCode: v }))}
                options={units.map((u) => ({ value: u.code, label: u.name }))}
              />
            </div>
          </div>
          {variantFields.length === 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.initialStockLabel')} *</label>
              <input
                type="number"
                min="0"
                step="any"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={variantCombinations[0]?.qty ?? ''}
                onChange={(e) => updateVariantQty(0, e.target.value)}
                required
              />
            </div>
          )}
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
            <div className="mt-1">
              <CustomSelect
                value={form.warrantyDurationUnit}
                onChange={(v) => setForm((f) => ({ ...f, warrantyDurationUnit: v }))}
                options={[
                  { value: 'DAYS', label: t('products.warrantyDays') },
                  { value: 'MONTHS', label: t('products.warrantyMonths') },
                  { value: 'YEARS', label: t('products.warrantyYears') },
                ]}
              />
            </div>
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
                className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {t('products.addRow')}
              </button>
            )}
          </div>
          {variantFields.length > 0 && (
            <div className="mt-2 space-y-2">
              {variantCombinations.map((row, rowIdx) => (
                <div key={rowIdx} className="border border-gray-100 rounded-xl p-2.5 space-y-2">
                  <div className="flex gap-2 items-center">
                    {variantFields.map((field) => (
                      <div key={field.id} className="flex-1">
                        <VariantFieldInput
                          field={field}
                          value={row.values[field.name] ?? ''}
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
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-gray-500">
                      {t('products.initialStockLabel')} *
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-normal"
                        value={row.qty}
                        onChange={(e) => updateVariantQty(rowIdx, e.target.value)}
                        required
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-500">
                      {t('products.buyPrice')}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-normal"
                        value={row.costPrice}
                        onChange={(e) => updateVariantCost(rowIdx, e.target.value)}
                        required
                      />
                    </label>
                  </div>
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
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
            {t('products.selectCategoryFirst')}
          </div>
        )}

      </form>

      {/* Submit bar sits above the raised middle tab, not just the nav base. */}
      <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-full max-w-[768px] z-50 bg-white border-t border-gray-100 px-4 py-3">
        <button
          onClick={handleSubmit as React.MouseEventHandler}
          disabled={!form.categoryId || mutation.isPending}
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
      <CustomSelect
        triggerClassName="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white text-left"
        value={value}
        onChange={onChange}
        placeholder={field.name}
        options={options.map((o) => ({ value: o, label: o }))}
      />
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
      <CustomSelect
        value={value}
        onChange={onChange}
        placeholder={`${field.name}…`}
        options={options.map((o) => ({ value: o, label: o }))}
      />
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
