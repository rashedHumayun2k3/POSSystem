'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getUnits, createProduct } from '@/lib/catalogApi';
import { getAppSettings } from '@/lib/settingsApi';
import type { Category, CategoryField } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';
import ImageUploadField from '@/components/ui/ImageUploadField';
import CustomSelect from '@/components/ui/CustomSelect';
import { categoryDisplayName } from '@/lib/categoryDisplay';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';
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
    packagingCostPerUnit: '0',
    lowStockThreshold: '5',
    description: '',
    note: '',
    attributesJson: '{}',
    warrantyDurationValue: '',
    warrantyDurationUnit: 'MONTHS',
  });

  const [variantCombinations, setVariantCombinations] = useState<VariantRow[]>([{ values: {}, qty: '', costPrice: '' }]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showMarketPrice, setShowMarketPrice] = useState(false);
  const [wholesaleOn, setWholesaleOn] = useState(false);
  const [wholesaleMinQty, setWholesaleMinQty] = useState('');
  const [wholesaleUnitPrice, setWholesaleUnitPrice] = useState('');
  const [wholesaleNote, setWholesaleNote] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const { data: units = UNITS_FALLBACK } = useQuery({ queryKey: ['units'], queryFn: getUnits });
  const { data: appSettings } = useQuery({ queryKey: ['app-settings'], queryFn: getAppSettings });

  // Retail-only shops never see the wholesale option at all — a pure UI-visibility switch, the
  // per-product schema always has the two columns regardless of this setting.
  const showWholesaleOption = (appSettings?.selling_mode ?? 'BOTH') !== 'RETAIL';

  const wholesaleMinQtyPreview = parseFloat(wholesaleMinQty);
  const wholesaleUnitPricePreview = parseFloat(wholesaleUnitPrice);
  const sellingPricePreview = parseFloat(form.sellingPrice) || 0;
  const wholesaleComplete = wholesaleOn && !isNaN(wholesaleMinQtyPreview) && wholesaleMinQtyPreview >= 2
    && !isNaN(wholesaleUnitPricePreview) && wholesaleUnitPricePreview > 0;
  const wholesalePreviewLines = wholesaleComplete
    ? [
        `${t('products.retailWord')}: 1–${wholesaleMinQtyPreview - 1} ${t('products.pieceWord')}: ৳${sellingPricePreview} ${t('products.eachWord')}`,
        `${t('products.wholesaleWord')}: ${wholesaleMinQtyPreview}+ ${t('products.pieceWord')}: ৳${wholesaleUnitPricePreview} ${t('products.eachWord')}`,
      ]
    : [`${t('products.anyQuantityWord')}: ৳${sellingPricePreview} ${t('products.eachWord')}`];

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

  // Wholesale-only shops expect to fill this in on almost every product, so it starts checked —
  // still just a default, staff can uncheck it for a one-off retail-only item. Applied once, so
  // it doesn't stomp on the checkbox if staff already toggled it before the setting arrived.
  const appliedWholesaleDefault = useRef(false);
  useEffect(() => {
    if (appliedWholesaleDefault.current || !appSettings) return;
    if (appSettings.selling_mode === 'WHOLESALE') {
      setWholesaleOn(true);
    }
    appliedWholesaleDefault.current = true;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) { useToastStore.getState().show(t('products.categoryRequired'), 'error'); return; }
    if (!form.name.trim()) { useToastStore.getState().show(t('products.nameRequired'), 'error'); return; }
    if (!form.imageUrl) { useToastStore.getState().show(t('products.imageRequired'), 'error'); return; }
    for (const row of variantCombinations) {
      if (!row.qty || parseFloat(row.qty) <= 0) { useToastStore.getState().show(t('products.stockValueRequired'), 'error'); return; }
      if (row.costPrice === '' || parseFloat(row.costPrice) < 0) { useToastStore.getState().show(t('products.costRequired'), 'error'); return; }
    }

    let wholesaleMinQtyNum: number | null = null;
    let wholesaleUnitPriceNum: number | null = null;
    if (showWholesaleOption && wholesaleOn) {
      wholesaleMinQtyNum = parseFloat(wholesaleMinQty);
      wholesaleUnitPriceNum = parseFloat(wholesaleUnitPrice);
      if (!wholesaleMinQty || isNaN(wholesaleMinQtyNum) || wholesaleMinQtyNum < 2) {
        useToastStore.getState().show(t('products.wholesaleMinQtyInvalid'), 'error'); return;
      }
      if (!wholesaleUnitPrice || isNaN(wholesaleUnitPriceNum) || wholesaleUnitPriceNum <= 0) {
        useToastStore.getState().show(t('products.wholesalePriceRequired'), 'error'); return;
      }
      if (wholesaleUnitPriceNum >= parseFloat(form.sellingPrice)) {
        useToastStore.getState().show(t('products.wholesalePriceMustBeLower'), 'error'); return;
      }
    }

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
      variantCombinations: variantCombinations.map((row) => ({
        values: row.values,
        qty: parseFloat(row.qty),
        costPrice: parseFloat(row.costPrice),
      })),
      warrantyDurationValue: form.warrantyDurationValue ? parseInt(form.warrantyDurationValue) : null,
      warrantyDurationUnit: form.warrantyDurationValue ? form.warrantyDurationUnit : null,
      wholesaleMinQty: wholesaleMinQtyNum,
      wholesaleUnitPrice: wholesaleUnitPriceNum,
      wholesaleNote: showWholesaleOption && wholesaleOn && wholesaleNote.trim() ? wholesaleNote.trim() : null,
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
              onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
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
            <div className="mt-1">
              <CustomSelect
                value={form.unitCode}
                onChange={(v) => setForm((f) => ({ ...f, unitCode: v }))}
                options={units.map((u) => ({ value: u.code, label: u.name }))}
              />
            </div>
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
            className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium"
          >
            <PlusIcon className="w-3.5 h-3.5" />
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

        {/* Wholesale (পাইকারি) pricing — single additive tier, hidden entirely for Retail-only
            shops (selling_mode setting). Retail price above always still applies below MinQty. */}
        {showWholesaleOption && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={wholesaleOn}
                onChange={(e) => setWholesaleOn(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-900">{t('products.wholesaleToggleLabel')}</span>
            </label>

            <div className={`grid grid-cols-2 gap-3 rounded-xl p-3 ${wholesaleOn ? 'bg-white' : 'bg-white opacity-50 pointer-events-none'}`}>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.wholesaleMinQtyLabel')}</label>
                <input
                  type="number"
                  min={2}
                  step="1"
                  disabled={!wholesaleOn}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  placeholder="10"
                  value={wholesaleMinQty}
                  onChange={(e) => setWholesaleMinQty(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.wholesaleUnitPriceLabel')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!wholesaleOn}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  placeholder="85"
                  value={wholesaleUnitPrice}
                  onChange={(e) => setWholesaleUnitPrice(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.wholesaleNoteLabel')}</label>
              <textarea
                disabled={!wholesaleOn}
                rows={2}
                maxLength={200}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white resize-none disabled:opacity-50"
                placeholder={t('products.wholesaleNotePlaceholder')}
                value={wholesaleNote}
                onChange={(e) => setWholesaleNote(e.target.value)}
              />
            </div>

            <div className="bg-indigo-900 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wide mb-1">{t('products.wholesalePreviewLabel')}</p>
              {wholesalePreviewLines.map((line, i) => (
                <p key={i} className="text-sm text-white">{line}</p>
              ))}
              {wholesaleOn && wholesaleNote.trim() && (
                <p className="text-xs text-indigo-300 mt-1.5 pt-1.5 border-t border-indigo-800">{wholesaleNote.trim()}</p>
              )}
            </div>
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

        {/* Opening stock + buy price — required for every variant, so a product can never exist
            without a cost basis. For a product with no variant matrix, this is the single
            implicit variant's qty/cost; for a multi-variant product these move inline into each
            row below instead. */}
        {variantFields.length === 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.initialStockLabel')}</label>
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
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.buyPrice')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={variantCombinations[0]?.costPrice ?? ''}
                onChange={(e) => updateVariantCost(0, e.target.value)}
                required
              />
            </div>
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
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      placeholder={t('products.initialStockLabel')}
                      value={row.qty}
                      onChange={(e) => updateVariantQty(rowIdx, e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      placeholder={t('products.buyPrice')}
                      value={row.costPrice}
                      onChange={(e) => updateVariantCost(rowIdx, e.target.value)}
                      required
                    />
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
