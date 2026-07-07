'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProduct, getCategories, getUnits, updateProduct } from '@/lib/catalogApi';
import { useLanguage } from '@/i18n/LanguageContext';
import ImageUploadField from '@/components/ui/ImageUploadField';

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

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useLanguage();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
  });

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const { data: units = UNITS_FALLBACK } = useQuery({ queryKey: ['units'], queryFn: getUnits });

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
  });
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Pre-fill once the product arrives — guarded by `loaded` so it doesn't stomp on the user's
  // in-progress edits if this query happens to refetch in the background.
  useEffect(() => {
    if (product && !loaded) {
      setForm({
        categoryId: product.categoryId,
        name: product.name,
        imageUrl: product.imageUrl,
        unitCode: product.unitCode,
        sellingPrice: String(product.sellingPrice),
        marketPrice: product.marketPrice != null ? String(product.marketPrice) : '',
        packagingCostPerUnit: String(product.packagingCostPerUnit ?? 0),
        lowStockThreshold: String(product.lowStockThreshold),
        description: product.description ?? '',
        note: product.note ?? '',
      });
      setLoaded(true);
    }
  }, [product, loaded]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!product?.rowVer) throw new Error('Missing rowVer');
      return updateProduct(id, {
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
        // Not editable in this form — passed through unchanged. UpdateAsync overwrites every
        // field from the request (not a partial patch), so omitting these would silently wipe them.
        defectNotes: product.defectNotes,
        attributesJson: product.attributesJson,
        status: product.status,
        rowVer: product.rowVer,
      });
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product', id] });
      router.push(`/products/${updated.id}`);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      if (e.response?.status === 409) {
        setError(t('products.editConflict'));
      } else {
        setError(e.response?.data?.message ?? t('products.failedUpdate'));
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.categoryId) { setError(t('products.categoryRequired')); return; }
    if (!form.name.trim()) { setError(t('products.nameRequired')); return; }
    mutation.mutate();
  };

  if (isLoading || !loaded) {
    return (
      <div className="px-4 pt-4 pb-20">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="pb-36">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">{t('products.editTitle')}</h1>
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

        {/* Product photo — optional here, unlike New Product. Not retroactively forcing every
            existing product (many pre-date the mandatory-photo rule) to get a photo just to
            fix e.g. a price. */}
        <ImageUploadField
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          label={t('products.imageLabel')}
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

      {/* Submit bar — sits above the fixed bottom tab bar (h-16), not behind it */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[768px] z-50 bg-white border-t border-gray-100 px-4 py-3">
        <button
          onClick={handleSubmit as React.MouseEventHandler}
          disabled={mutation.isPending}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
        >
          {mutation.isPending ? t('common.saving') : t('products.saveBtn')}
        </button>
      </div>
    </div>
  );
}
