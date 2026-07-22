'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { getProduct, archiveProduct, setProductMarketplaceVisibility, getPriceSlots, createPriceSlot, activatePriceSlot, getPriceSlotHistory, downloadBarcodeLabels, updateProduct, updateVariant, addVariant, getCategory, getStockAdjustments, adjustStock, getProductReviews, replyToReview, deleteReviewReply, setReviewHidden, updateMarketplaceDetails, addProductImage, removeProductImage, reorderProductImages, getMarketplaceDetailTemplates } from '@/lib/catalogApi';
import { listOrdersByProduct } from '@/lib/ordersApi';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { toastError } from '@/lib/toastError';
import { uploadImage } from '@/lib/media';
import type { Variant, PriceSlot, PriceActivationLog, CategoryField, StockAdjustment, StockAdjustReason, AdminProductReview, ProductDetail, MarketplaceDetailSection } from '@/types/catalog';
import type { OrderListItem } from '@/types/orders';
import { useLanguage } from '@/i18n/LanguageContext';
import StatusBadge from '@/components/ui/StatusBadge';
import { resolveMediaUrl } from '@/lib/media';
import ImageUploadField from '@/components/ui/ImageUploadField';

type TabKey = 'info' | 'variants' | 'prices' | 'stock' | 'orders' | 'reviews' | 'marketplace';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';
  const canAdjustStock = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const canManageReviews = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      router.back();
    },
  });

  const marketplaceVisibilityMutation = useMutation({
    mutationFn: (show: boolean) => setProductMarketplaceVisibility(id, show),
    onSuccess: (result) => {
      qc.setQueryData(['product', id], (prev: typeof product) =>
        prev ? { ...prev, showOnMarketplace: result.showOnMarketplace } : prev);
    },
  });

  // Lets the Info tab set Product.ImageUrl directly — no need to enter Edit mode just to change
  // the one field that actually controls marketplace visibility/the card image everywhere. The
  // update endpoint is a full replace (UpdateProductRequest requires every field), so the rest of
  // the payload is carried over unchanged from the currently-loaded product.
  const productImageMutation = useMutation({
    mutationFn: (imageUrl: string | null) =>
      updateProduct(id, {
        categoryId: product!.categoryId,
        name: product!.name,
        imageUrl,
        description: product!.description,
        defectNotes: product!.defectNotes,
        unitCode: product!.unitCode,
        sellingPrice: product!.sellingPrice,
        marketPrice: product!.marketPrice,
        packagingCostPerUnit: product!.packagingCostPerUnit ?? 0,
        lowStockThreshold: product!.lowStockThreshold,
        attributesJson: product!.attributesJson,
        note: product!.note,
        status: product!.status,
        rowVer: product!.rowVer!,
        warrantyDurationValue: product!.warrantyDurationValue,
        warrantyDurationUnit: product!.warrantyDurationUnit,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product', id] }),
  });

  if (isLoading) {
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

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'info', label: t('products.tabInfo') },
    { key: 'variants', label: t('products.tabVariants') },
    ...(isOwner ? [{ key: 'prices' as TabKey, label: t('products.tabPrices') }] : []),
    ...(canAdjustStock ? [{ key: 'stock' as TabKey, label: t('products.tabStock') }] : []),
    { key: 'orders', label: t('products.tabOrders') },
    ...(canManageReviews ? [{ key: 'reviews' as TabKey, label: t('products.tabReviews') }] : []),
    ...(isOwner ? [{ key: 'marketplace' as TabKey, label: t('products.tabMarketplace') }] : []),
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{product.name}</h1>
            <p className="text-xs text-gray-400">{product.sku} · {product.categoryName}</p>
          </div>
          {isOwner && (
            <Link
              href={`/products/${id}/edit`}
              className="text-xs text-indigo-600 font-medium border border-indigo-200 px-2 py-1 rounded-lg"
            >
              {t('products.edit')}
            </Link>
          )}
          {isOwner && product.status === 'ACTIVE' && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-red-500 font-medium border border-red-200 px-2 py-1 rounded-lg"
            >
              {t('products.delete')}
            </button>
          )}
        </div>

        {/* Tabs — horizontally scrollable; the right-edge fade + arrow signal "more tabs this
            way" (arrow also actually scrolls on tap, not just decorative). */}
        <div className="relative mt-3">
          <div ref={tabsScrollRef} className="flex gap-0 border-b border-gray-100 -mb-px overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent" />
          <button
            type="button"
            onClick={() => tabsScrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' })}
            className="absolute top-0 right-0 bottom-px flex items-center px-1 text-indigo-500"
            aria-label={t('common.scrollRight')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        {activeTab === 'info' && (
          <InfoTab
            product={product}
            isOwner={isOwner}
            t={t}
            onToggleMarketplaceVisibility={(show) => marketplaceVisibilityMutation.mutate(show)}
            marketplaceVisibilityPending={marketplaceVisibilityMutation.isPending}
            onChangeImage={(url) => productImageMutation.mutate(url)}
          />
        )}
        {activeTab === 'variants' && (
          <VariantsTab
            variants={product.variants}
            isOwner={isOwner}
            productId={id}
            categoryId={product.categoryId}
            t={t}
            onSelectForPrice={(v) => {
              setSelectedVariant(v);
              setActiveTab('prices');
            }}
          />
        )}
        {activeTab === 'prices' && isOwner && (
          <PricesTab
            variants={product.variants}
            selectedVariant={selectedVariant}
            onSelectVariant={setSelectedVariant}
            baseSellingPrice={product.sellingPrice}
            marketPrice={product.marketPrice}
            packagingCostPerUnit={product.packagingCostPerUnit ?? 0}
            t={t}
          />
        )}
        {activeTab === 'stock' && canAdjustStock && (
          <StockAdjustmentTab
            variants={product.variants}
            selectedVariant={selectedVariant}
            onSelectVariant={setSelectedVariant}
            t={t}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab productId={id} />
        )}
        {activeTab === 'reviews' && canManageReviews && (
          <ReviewsTab productId={id} t={t} />
        )}
        {activeTab === 'marketplace' && isOwner && (
          <MarketplaceTab product={product} t={t} />
        )}
      </div>

      {/* Delete confirmation — this calls the same archive endpoint as before (soft, reversible
          via the database — products with order/purchase history can never be truly deleted
          without breaking historical records), just presented as "Delete" since that's the
          action a shop owner expects. */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <p className="text-base font-semibold text-red-600">{t('products.deleteTitle')}</p>
            <p className="text-sm text-gray-500">{t('products.deleteWarning')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {archiveMutation.isPending ? t('products.deleting') : t('products.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Info Tab ──────────────────────────────────────────────────────────────────

function InfoTab({
  product,
  isOwner,
  t,
  onToggleMarketplaceVisibility,
  marketplaceVisibilityPending,
  onChangeImage,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product: any;
  isOwner: boolean;
  t: (key: string) => string;
  onToggleMarketplaceVisibility: (show: boolean) => void;
  marketplaceVisibilityPending: boolean;
  onChangeImage: (url: string | null) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Photo — this is Product.ImageUrl, the field the public marketplace/shop listing
          actually reads for the card image and requires to be set at all. Owner can set/replace
          it directly here; staff (non-owner) just see it read-only, same visibility rule as the
          rest of this tab. */}
      {isOwner ? (
        <ImageUploadField
          value={product.imageUrl}
          onChange={onChangeImage}
          label={t('products.imageLabel')}
          uploadingLabel={t('products.imageUploading')}
          errorLabel={t('products.imageUploadFailed')}
          removeLabel={t('products.imageRemove')}
        />
      ) : (
        product.imageUrl && (
          <div className="w-full h-48 rounded-xl bg-gray-100 overflow-hidden">
            <img
              src={resolveMediaUrl(product.imageUrl) ?? ''}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        )
      )}

      {/* Price block */}
      <div className="bg-indigo-50 rounded-xl p-4 space-y-1.5">
        {product.marketPrice ? (
          <>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{t('products.marketPrice')}</span>
              <span className="text-sm font-semibold text-gray-600 line-through">৳{product.marketPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-indigo-500 font-medium">{t('products.priceAfterDiscount')}</span>
              <span className="text-lg font-bold text-indigo-700">
                ৳{product.sellingPrice.toLocaleString()}
                {product.marketPrice > product.sellingPrice && (
                  <span className="text-xs font-medium text-green-600 ml-1.5">
                    ({t('products.discountLabel')}: {Math.round(((product.marketPrice - product.sellingPrice) / product.marketPrice) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          </>
        ) : (
          // No Product Price set — just the plain price, no discount framing.
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">{t('products.sellingPrice')}</span>
            <span className="text-lg font-bold text-indigo-700">৳{product.sellingPrice.toLocaleString()}</span>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="grid grid-cols-2 gap-3">
          <InfoTile label={t('products.packagingCostInfo')} value={`৳${product.packagingCostPerUnit ?? 0}`} />
          <InfoTile label={t('products.lowStockInfo')} value={`${product.lowStockThreshold} ${product.unitCode}`} />
        </div>
      )}

      {isOwner && (
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{t('products.showOnMarketplace')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('products.showOnMarketplaceDesc')}</p>
          </div>
          <ToggleSwitch
            checked={product.showOnMarketplace ?? true}
            disabled={marketplaceVisibilityPending}
            onChange={() => onToggleMarketplaceVisibility(!(product.showOnMarketplace ?? true))}
          />
        </div>
      )}

      {product.description && (
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium mb-1">{t('products.description')}</p>
          <p className="text-sm text-gray-700">{product.description}</p>
        </div>
      )}

      {product.note && (
        <div className="bg-yellow-50 rounded-xl p-3">
          <p className="text-xs text-yellow-600 font-medium mb-1">{t('products.note')}</p>
          <p className="text-sm text-gray-700">{product.note}</p>
        </div>
      )}

      <div className="flex gap-2">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          product.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {product.status === 'ACTIVE' ? t('products.active') : t('products.archived')}
        </span>
        <span className="text-xs text-gray-400 py-1">{t('products.unitInfo')}: {product.unitCode}</span>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-12 h-7 rounded-full shrink-0 transition-colors disabled:opacity-50 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Variants Tab ──────────────────────────────────────────────────────────────

function VariantsTab({
  variants,
  isOwner,
  productId,
  categoryId,
  onSelectForPrice,
  t,
}: {
  variants: Variant[];
  isOwner: boolean;
  productId: string;
  categoryId: string;
  onSelectForPrice: (v: Variant) => void;
  t: (key: string) => string;
}) {
  const [labelQty, setLabelQty] = useState(1);
  const [printingAll, setPrintingAll] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [newPriceOverride, setNewPriceOverride] = useState('');
  const qc = useQueryClient();

  const { data: category } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => getCategory(categoryId),
    enabled: isOwner && !!categoryId,
  });
  const variantFields = category?.fields.filter((f) => f.isVariant) ?? [];

  const imageMutation = useMutation({
    mutationFn: ({ variant, imageUrl }: { variant: Variant; imageUrl: string | null }) =>
      updateVariant(productId, variant.id, {
        imageUrl,
        note: variant.note,
        priceOverride: variant.priceOverride,
        isDefault: variant.isDefault,
        rowVer: variant.rowVer!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product', productId] }),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addVariant(productId, {
        variantValuesJson: JSON.stringify(newName.trim() ? { Name: newName.trim(), ...newValues } : newValues),
        barcode: null,
        imageUrl: newImageUrl,
        note: newNote.trim() || null,
        priceOverride: newPriceOverride ? parseFloat(newPriceOverride) : null,
        isDefault: false,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', productId] });
      setShowAddForm(false);
      setNewName('');
      setNewValues({});
      setNewImageUrl(null);
      setNewNote('');
      setNewPriceOverride('');
    },
    onError: (err: unknown) => toastError(err, t('products.addVariantFailed')),
  });

  const handlePrintAll = async () => {
    setPrintingAll(true);
    try { await downloadBarcodeLabels(productId, labelQty); } finally { setPrintingAll(false); }
  };

  const handlePrintOne = async (variantId: string) => {
    setPrintingId(variantId);
    try { await downloadBarcodeLabels(productId, labelQty, variantId); } finally { setPrintingId(null); }
  };

  return (
    <div className="space-y-3">
      {/* Print labels toolbar */}
      {isOwner && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          <span className="text-xs text-gray-500 shrink-0">Qty per label</span>
          <input
            type="number"
            min={1}
            max={500}
            value={labelQty}
            onChange={(e) => setLabelQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center"
          />
          <button
            onClick={handlePrintAll}
            disabled={printingAll}
            className="ml-auto text-xs font-medium text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {printingAll ? 'Generating…' : '🖨 Print All Labels'}
          </button>
        </div>
      )}

      {variants.map((v) => {
        const vals = JSON.parse(v.variantValuesJson || '{}') as Record<string, string>;
        const label = Object.values(vals).filter(Boolean).join(' / ') || 'Default';

        return (
          <div key={v.id} className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('products.sku')}: {v.sku}</p>
                <p className="text-xs text-gray-400">{t('products.barcode')}: {v.barcode}</p>
                {v.note && (
                  <p className="text-xs text-gray-500 mt-1 bg-yellow-50 rounded px-2 py-1">{v.note}</p>
                )}
              </div>
              <div className="text-right">
                {v.priceOverride != null ? (
                  <p className="text-sm font-semibold text-indigo-600">৳{v.priceOverride.toLocaleString()}</p>
                ) : (
                  <p className="text-xs text-gray-400">{t('products.basePrice')}</p>
                )}
                {isOwner && v.avgLandedCost != null && v.avgLandedCost > 0 && (
                  <p className="text-xs text-gray-400">{t('products.cost')}: ৳{v.avgLandedCost.toLocaleString()}</p>
                )}
              </div>
            </div>
            {isOwner && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => onSelectForPrice(v)}
                  className="text-xs text-indigo-600 font-medium"
                >
                  {t('products.changePriceArrow')}
                </button>
                <button
                  onClick={() => handlePrintOne(v.id)}
                  disabled={printingId === v.id}
                  className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-lg disabled:opacity-50"
                >
                  {printingId === v.id ? '…' : '🖨 Label'}
                </button>
              </div>
            )}
            {isOwner && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <ImageUploadField
                  value={v.imageUrl}
                  onChange={(url) => imageMutation.mutate({ variant: v, imageUrl: url })}
                  label={t('products.variantImageLabel')}
                  uploadingLabel={t('products.imageUploading')}
                  errorLabel={t('products.imageUploadFailed')}
                  removeLabel={t('products.imageRemove')}
                />
                <p className="text-[11px] text-gray-400 mt-1">{t('products.variantImageHint')}</p>
              </div>
            )}
          </div>
        );
      })}

      {isOwner && !showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full border border-dashed border-indigo-300 text-indigo-600 font-medium py-2.5 rounded-xl text-sm"
        >
          {t('products.addVariantBtn')}
        </button>
      )}

      {isOwner && showAddForm && (
        <div className="bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
          <p className="text-sm font-semibold text-indigo-900">{t('products.addVariantTitle')}</p>

          <input
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={t('products.variantNameLabel')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          {variantFields.map((field) => (
            <VariantFieldInput
              key={field.id}
              field={field}
              value={newValues[field.name] ?? ''}
              onChange={(v) => setNewValues((prev) => ({ ...prev, [field.name]: v }))}
            />
          ))}

          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
            placeholder={t('products.priceOverrideLabel')}
            value={newPriceOverride}
            onChange={(e) => setNewPriceOverride(e.target.value)}
          />

          <textarea
            className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white resize-none"
            rows={2}
            placeholder={t('products.variantNoteLabel')}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />

          <ImageUploadField
            value={newImageUrl}
            onChange={setNewImageUrl}
            label={t('products.variantImageLabel')}
            uploadingLabel={t('products.imageUploading')}
            errorLabel={t('products.imageUploadFailed')}
            removeLabel={t('products.imageRemove')}
          />


          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewName(''); setNewValues({}); setNewImageUrl(null); setNewNote(''); setNewPriceOverride(''); }}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white disabled:opacity-60"
            >
              {addMutation.isPending ? t('common.saving') : t('products.addVariantSave')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Variant field input (dropdown/text, mirrors products/new's variant-combination inputs) ──

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
        className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
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
      className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
      placeholder={field.name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ── Prices Tab ────────────────────────────────────────────────────────────────

function PricesTab({
  variants,
  selectedVariant,
  onSelectVariant,
  baseSellingPrice,
  marketPrice,
  packagingCostPerUnit,
  t,
}: {
  variants: Variant[];
  selectedVariant: Variant | null;
  onSelectVariant: (v: Variant) => void;
  baseSellingPrice: number;
  marketPrice: number | null;
  packagingCostPerUnit: number;
  t: (key: string) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formReason, setFormReason] = useState('');
  const qc = useQueryClient();

  const active = selectedVariant ?? variants[0];

  const { data: slots = [] } = useQuery<PriceSlot[]>({
    queryKey: ['priceSlots', active?.id],
    queryFn: () => getPriceSlots(active.id),
    enabled: !!active,
  });

  const { data: history = [] } = useQuery<PriceActivationLog[]>({
    queryKey: ['priceSlotHistory', active?.id],
    queryFn: () => getPriceSlotHistory(active.id),
    enabled: !!active,
  });

  const createMutation = useMutation({
    mutationFn: () => createPriceSlot(active.id, {
      label: formLabel.trim(),
      newPrice: parseFloat(formPrice),
      reason: formReason.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priceSlots', active.id] });
      qc.invalidateQueries({ queryKey: ['priceSlotHistory', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
      setShowForm(false);
      setFormLabel('');
      setFormPrice('');
      setFormReason('');
    },
    onError: (err: unknown) => toastError(err, t('products.failedCreateSlot')),
  });

  const activateMutation = useMutation({
    mutationFn: (slotId: string) => activatePriceSlot(active.id, slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priceSlots', active.id] });
      qc.invalidateQueries({ queryKey: ['priceSlotHistory', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) { useToastStore.getState().show(t('products.slotLabelRequired'), 'error'); return; }
    if (!formPrice || parseFloat(formPrice) <= 0) { useToastStore.getState().show(t('products.slotPriceRequired'), 'error'); return; }
    createMutation.mutate();
  };

  const activeSlot = slots.find(s => s.isActive);
  const effectiveSellPrice = activeSlot?.price ?? (active?.priceOverride ?? baseSellingPrice);
  const landedCost = active?.avgLandedCost ?? 0;
  const totalCost = landedCost + packagingCostPerUnit;
  const currentMargin = effectiveSellPrice > 0
    ? ((effectiveSellPrice - totalCost) / effectiveSellPrice) * 100
    : 0;

  const previewPrice = parseFloat(formPrice);
  const previewMargin = !isNaN(previewPrice) && previewPrice > 0
    ? ((previewPrice - totalCost) / previewPrice) * 100
    : null;
  const isBelowCost = landedCost > 0 && previewMargin !== null && previewMargin < 0;

  const marginColor = (m: number) =>
    m >= 20 ? 'text-green-600' : m >= 10 ? 'text-amber-600' : 'text-red-600';
  const marginBg = (m: number) =>
    m >= 20 ? 'bg-green-50' : m >= 10 ? 'bg-amber-50' : 'bg-red-50';

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Cost snapshot card */}
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('products.costStructure')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">{t('products.avgBuyCost')}</span>
            <span className="text-xs font-medium text-gray-700">
              {landedCost > 0 ? `৳${landedCost.toLocaleString()}` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">{t('products.packagingCostInfo')}</span>
            <span className="text-xs font-medium text-gray-700">
              {packagingCostPerUnit > 0 ? `৳${packagingCostPerUnit.toLocaleString()}` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs font-semibold text-gray-600">{t('products.totalCost')}</span>
            <span className="text-xs font-semibold text-gray-800">
              {totalCost > 0 ? `৳${totalCost.toLocaleString()}` : '—'}
            </span>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-2 sm:hidden" />
        <div className={`mt-2 rounded-xl border ${marginBg(currentMargin)} border-purple-100 p-2.5`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-purple-500">{t('products.marketPrice')}</span>
            <span className="text-base font-bold text-purple-700">
              {marketPrice ? `৳${marketPrice.toLocaleString()}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              {t('products.selling')} ৳{effectiveSellPrice.toLocaleString()} → {t('products.margin')}
            </span>
            <span className={`text-xs font-bold ${marginColor(currentMargin)}`}>
              {currentMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Variant selector */}
      {variants.length > 1 && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.selectVariant')}</label>
          <select
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={active?.id ?? ''}
            onChange={(e) => {
              const v = variants.find((x) => x.id === e.target.value);
              if (v) onSelectVariant(v);
            }}
          >
            {variants.map((v) => {
              const vals = JSON.parse(v.variantValuesJson || '{}') as Record<string, string>;
              const label = Object.values(vals).filter(Boolean).join(' / ') || 'Default';
              return <option key={v.id} value={v.id}>{label}</option>;
            })}
          </select>
        </div>
      )}

      {/* Price slots list — active always on top */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('products.priceSlots')}</p>
        <div className="space-y-2">
          {[...slots].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)).map((slot) => (
            <label
              key={slot.id}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                slot.isActive
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-gray-100 hover:border-gray-200'
              } ${activateMutation.isPending ? 'pointer-events-none opacity-60' : ''}`}
            >
              {/* Radio circle */}
              <div className="mt-0.5 shrink-0">
                <input
                  type="radio"
                  name={`slot-${active?.id}`}
                  checked={slot.isActive}
                  onChange={() => { if (!slot.isActive) activateMutation.mutate(slot.id); }}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  slot.isActive ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'
                }`}>
                  {slot.isActive && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${slot.isActive ? 'text-green-800' : 'text-gray-900'}`}>
                    {slot.label}
                  </span>
                  {slot.isActive && (
                    <span className="text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                      {t('products.currentlyUsed')}
                    </span>
                  )}
                </div>
                <p className={`text-lg font-bold mt-0.5 ${slot.isActive ? 'text-green-700' : 'text-gray-800'}`}>
                  ৳{slot.price.toLocaleString()}
                </p>
                {slot.reason && (
                  <p className="text-xs text-gray-500 mt-0.5">{slot.reason}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  {t('products.createdBy')} {slot.createdByName} · {fmtDate(slot.createdAt)}
                </p>
              </div>

              {/* "Is Currently Used" label on the right */}
              <div className="shrink-0 flex flex-col items-end justify-center">
                <span className={`text-[10px] font-medium ${slot.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {t('products.isCurrentlyUsed')}
                </span>
              </div>
            </label>
          ))}
        </div>

        {/* Add slot button / form */}
        {!showForm ? (
          <button
            onClick={() => { setShowForm(true); setFormLabel(t('products.slotLabelDefault')); }}
            className="mt-3 w-full border border-dashed border-indigo-300 text-indigo-600 font-medium py-2.5 rounded-xl text-sm"
          >
            + {t('products.addPriceSlot')}
          </button>
        ) : (
          <form onSubmit={handleCreateSubmit} className="mt-3 bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
            <p className="text-sm font-semibold text-indigo-900">{t('products.newPriceSlot')}</p>
            <input
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder={t('products.slotLabelPlaceholder')}
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              required
            />
            <div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                placeholder={t('products.slotPricePlaceholder')}
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                required
              />
              {previewMargin !== null && (
                <div className={`mt-1.5 rounded-lg px-2.5 py-1 flex justify-between items-center ${marginBg(previewMargin)}`}>
                  <span className="text-xs text-gray-500">{t('products.marginAt')} ৳{previewPrice.toLocaleString()}</span>
                  <span className={`text-xs font-bold ${marginColor(previewMargin)}`}>
                    {previewMargin.toFixed(1)}%
                  </span>
                </div>
              )}
              {isBelowCost && (
                <div className="mt-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-red-700">
                    Below cost — total cost is ৳{totalCost.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Loss of ৳{(totalCost - previewPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per sale.
                  </p>
                </div>
              )}
            </div>
            <input
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder={t('products.slotReasonPlaceholder')}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormLabel(''); setFormPrice(''); setFormReason(''); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className={`flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-60 text-white ${isBelowCost ? 'bg-red-500' : 'bg-indigo-600'}`}
              >
                {createMutation.isPending ? t('common.saving') : t('products.createSlot')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Activation history table */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('products.activationHistory')}</p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">{t('products.slotLabel')}</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">{t('products.slotPrice')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">{t('products.activatedFrom')}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">{t('products.activatedTo')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((log) => (
                  <tr key={log.id} className={log.deactivatedAt === null ? 'bg-indigo-50' : 'bg-white'}>
                    <td className="px-3 py-2 font-medium text-gray-800">{log.labelSnapshot}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-700">৳{log.priceSnapshot.toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtDateTime(log.activatedAt)}</td>
                    <td className="px-3 py-2">
                      {log.deactivatedAt === null
                        ? <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">{t('products.active')}</span>
                        : <span className="text-gray-400">{fmtDateTime(log.deactivatedAt)}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stock Adjustment Tab ────────────────────────────────────────────────────────

const REASON_KEYS: Record<StockAdjustReason, string> = {
  EXISTING_STOCK: 'products.stockReasonExistingStock',
  DAMAGED: 'products.stockReasonDamaged',
  LOST_THEFT: 'products.stockReasonLostTheft',
  RECOUNT: 'products.stockReasonRecount',
  FOUND_EXTRA: 'products.stockReasonFoundExtra',
  OTHER: 'products.stockReasonOther',
};

function StockAdjustmentTab({
  variants,
  selectedVariant,
  onSelectVariant,
  t,
}: {
  variants: Variant[];
  selectedVariant: Variant | null;
  onSelectVariant: (v: Variant) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState<StockAdjustReason>('EXISTING_STOCK');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const qc = useQueryClient();

  const active = selectedVariant ?? variants[0];

  const { data: history = [] } = useQuery<StockAdjustment[]>({
    queryKey: ['stockAdjustments', active?.id],
    queryFn: () => getStockAdjustments(active.id),
    enabled: !!active,
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      adjustStock(active.id, {
        reason,
        mode: 'SET',
        value: parseFloat(value),
        note: note.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stockAdjustments', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
      setValue('');
      setNote('');
      setShowForm(false);
    },
    onError: (err: unknown) => toastError(err, t('products.stockFailed')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || isNaN(parseFloat(value))) { useToastStore.getState().show(t('products.stockValueRequired'), 'error'); return; }
    adjustMutation.mutate();
  };

  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Variant selector */}
      {variants.length > 1 && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.selectVariant')}</label>
          <select
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={active?.id ?? ''}
            onChange={(e) => {
              const v = variants.find((x) => x.id === e.target.value);
              if (v) onSelectVariant(v);
            }}
          >
            {variants.map((v) => {
              const vals = JSON.parse(v.variantValuesJson || '{}') as Record<string, string>;
              const label = Object.values(vals).filter(Boolean).join(' / ') || 'Default';
              return <option key={v.id} value={v.id}>{label}</option>;
            })}
          </select>
        </div>
      )}

      {/* Current stock */}
      <div className="bg-indigo-50 rounded-xl p-4 flex justify-between items-center">
        <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">{t('products.stockCurrentLabel')}</p>
        <p className="text-2xl font-bold text-indigo-700">{active?.stock ?? 0}</p>
      </div>

      {/* Adjust Stock trigger — form stays collapsed until asked for, so the tab doesn't open
          straight into a data-entry form nobody asked to fill out yet. */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full py-2.5 rounded-xl text-sm font-medium bg-indigo-50 text-indigo-600 border border-indigo-200"
        >
          + {t('products.stockAdjustButton')}
        </button>
      )}

      {/* Adjustment form */}
      {showForm && (
      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {t('products.stockChangeLabel')}
          </label>
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.stockReasonLabel')}</label>
          <select
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value as StockAdjustReason)}
          >
            {(Object.keys(REASON_KEYS) as StockAdjustReason[]).map((r) => (
              <option key={r} value={r}>{t(REASON_KEYS[r])}</option>
            ))}
          </select>
        </div>

        <textarea
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
          rows={2}
          placeholder={t('products.stockNotePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowForm(false); setValue(''); setNote(''); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={adjustMutation.isPending}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white disabled:opacity-60"
          >
            {adjustMutation.isPending ? t('products.stockSubmitting') : t('products.stockSubmit')}
          </button>
        </div>
      </form>
      )}

      {/* Adjustment history */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('products.stockHistoryTitle')}</p>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('products.stockHistoryEmpty')}</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{t(REASON_KEYS[h.reason])}</span>
                  <span className={`text-sm font-bold tabular-nums ${h.qty >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {h.qty >= 0 ? '+' : ''}{h.qty}
                  </span>
                </div>
                {h.note && <p className="text-xs text-gray-500 mt-1">{h.note}</p>}
                <p className="text-[11px] text-gray-400 mt-1">
                  {h.userName} · {fmtDateTime(h.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, string> = {
  FACEBOOK: 'FB',
  WHATSAPP: 'WA',
  INSTAGRAM: 'IG',
  PHONE: '📞',
  SHOP: '🏪',
  ONLINE: '🌐',
};

function OrdersTab({ productId }: { productId: string }) {
  const { data: orders = [], isLoading } = useQuery<OrderListItem[]>({
    queryKey: ['product-orders', productId],
    queryFn: () => listOrdersByProduct(productId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No orders for this product yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/orders/${order.id}`}
          className="block bg-white rounded-xl shadow-sm border border-gray-100 p-3 active:bg-gray-50"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900">{order.orderNo}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                {CHANNEL_ICONS[order.channel] ?? order.channel}
              </span>
              {order.isDraft && (
                <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Draft</span>
              )}
            </div>
            <span className="text-sm font-semibold text-gray-900">৳{order.totalAmount.toLocaleString()}</span>
          </div>

          <div className="text-sm text-gray-700 mb-1">
            {order.customerName}{' '}
            <span className="text-gray-400 text-xs">{order.customerPhone}</span>
          </div>

          <div className="flex flex-wrap gap-1 items-center">
            <StatusBadge status={order.fulfillmentStatus} />
            <StatusBadge status={order.paymentStatus} />
            {order.dueAmount > 0 && (
              <span className="text-xs text-red-600 font-medium">
                বাকি ৳{order.dueAmount.toLocaleString()}
              </span>
            )}
            {order.handlingUserName && (
              <span className="text-xs text-gray-400 ml-auto">
                → {order.handlingUserName}
              </span>
            )}
          </div>

          <div className="text-xs text-gray-400 mt-1">
            {new Date(order.createdAt).toLocaleDateString('en-GB')}
            {order.trackingNo && (
              <span className="ml-2 text-indigo-600">{order.trackingNo}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Reviews Tab ──────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-xs">
      {'★'.repeat(rating)}
      <span className="text-gray-200">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewsTab({ productId, t }: { productId: string; t: (key: string) => string }) {
  const qc = useQueryClient();
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: reviews = [], isLoading } = useQuery<AdminProductReview[]>({
    queryKey: ['product-reviews', productId],
    queryFn: () => getProductReviews(productId),
  });

  const replyMutation = useMutation({
    mutationFn: (reviewId: string) => replyToReview(productId, reviewId, replyText.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
      setReplyTarget(null);
      setReplyText('');
    },
    onError: (err) => toastError(err, t('products.reviewReplyFailed')),
  });

  const hideMutation = useMutation({
    mutationFn: ({ reviewId, hidden }: { reviewId: string; hidden: boolean }) => setReviewHidden(productId, reviewId, hidden),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-reviews', productId] }),
  });

  const deleteReplyMutation = useMutation({
    mutationFn: (reviewId: string) => deleteReviewReply(productId, reviewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-reviews', productId] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        {t('products.noReviewsYet')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className={`bg-white rounded-xl shadow-sm border p-3 ${r.isHidden ? 'border-gray-200 opacity-60' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900">{r.reviewerName}</span>
              <Stars rating={r.rating} />
            </div>
            <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-GB')}</span>
          </div>

          <p className="text-sm text-gray-700 mb-2">{r.body}</p>

          {r.images.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {r.images.map((img) => (
                <img key={img.id} src={resolveMediaUrl(img.imageUrl) ?? ''} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-100" />
              ))}
            </div>
          )}

          {r.reply && replyTarget !== r.id && (
            <div className="bg-gray-50 rounded-lg p-2.5 mb-2">
              <p className="text-xs font-semibold text-gray-500">{t('products.yourReply')}</p>
              <p className="text-sm text-gray-600 mt-0.5">{r.reply.body}</p>
            </div>
          )}

          {replyTarget === r.id ? (
            <div className="space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                placeholder={t('products.replyPlaceholder')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setReplyTarget(null); setReplyText(''); }}
                  className="flex-1 text-xs font-medium py-2 rounded-lg bg-gray-100 text-gray-600"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => replyMutation.mutate(r.id)}
                  disabled={replyMutation.isPending || !replyText.trim()}
                  className="flex-1 text-xs font-medium py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                >
                  {replyMutation.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setReplyTarget(r.id); setReplyText(r.reply?.body ?? ''); }}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-600"
              >
                {r.reply ? t('products.editReply') : t('products.reply')}
              </button>
              {r.reply && (
                <button
                  onClick={() => {
                    if (window.confirm(t('products.deleteReplyConfirm'))) deleteReplyMutation.mutate(r.id);
                  }}
                  disabled={deleteReplyMutation.isPending}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 disabled:opacity-50"
                >
                  {t('products.deleteReply')}
                </button>
              )}
              <button
                onClick={() => hideMutation.mutate({ reviewId: r.id, hidden: !r.isHidden })}
                disabled={hideMutation.isPending}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border disabled:opacity-50 ${
                  r.isHidden ? 'border-emerald-200 text-emerald-600' : 'border-red-200 text-red-600'
                }`}
              >
                {r.isHidden ? t('products.unhideReview') : t('products.hideReview')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Marketplace Tab ──────────────────────────────────────────────────────────
// Optional, freeform Style / Features & Specs / Item Details tables + a YouTube link — shown on
// the public ClientPage product page. No predefined schema (unlike Amazon's per-category
// taxonomy) — the seller just types label/value rows directly.

type DetailRow = { label: string; value: string };

const MARKETPLACE_SECTIONS: { key: MarketplaceDetailSection; labelKey: string }[] = [
  { key: 'STYLE', labelKey: 'products.sectionStyle' },
  { key: 'FEATURES_SPECS', labelKey: 'products.sectionFeaturesSpecs' },
  { key: 'ITEM_DETAILS', labelKey: 'products.sectionItemDetails' },
];

function MarketplaceTab({ product, t }: { product: ProductDetail; t: (key: string) => string }) {
  const qc = useQueryClient();
  const [youtubeUrl, setYoutubeUrl] = useState(product.youtubeUrl ?? '');
  const [marketplacePrice, setMarketplacePrice] = useState(
    product.marketplacePrice != null ? String(product.marketplacePrice) : ''
  );
  const [rows, setRows] = useState<Record<MarketplaceDetailSection, DetailRow[]>>(() => {
    const grouped: Record<MarketplaceDetailSection, DetailRow[]> = {
      STYLE: [],
      FEATURES_SPECS: [],
      ITEM_DETAILS: [],
    };
    for (const d of [...product.marketplaceDetails].sort((a, b) => a.sortOrder - b.sortOrder)) {
      grouped[d.section].push({ label: d.label, value: d.value });
    }
    return grouped;
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['marketplace-detail-templates'],
    queryFn: getMarketplaceDetailTemplates,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const details: { section: MarketplaceDetailSection; label: string; value: string; sortOrder: number }[] = [];
      (Object.keys(rows) as MarketplaceDetailSection[]).forEach((section) => {
        rows[section].forEach((row, i) => {
          if (row.label.trim() && row.value.trim()) {
            details.push({ section, label: row.label.trim(), value: row.value.trim(), sortOrder: i });
          }
        });
      });
      return updateMarketplaceDetails(product.id, {
        youtubeUrl: youtubeUrl.trim() || null,
        details,
        marketplacePrice: marketplacePrice.trim() ? parseFloat(marketplacePrice) : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', product.id] });
      useToastStore.getState().show(t('products.marketplaceSaved'));
    },
    onError: (err) => toastError(err, t('products.marketplaceSaveFailed')),
  });

  function updateRow(section: MarketplaceDetailSection, index: number, field: keyof DetailRow, value: string) {
    setRows((prev) => {
      const next = [...prev[section]];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [section]: next };
    });
  }

  function addRow(section: MarketplaceDetailSection, presetLabel?: string) {
    setRows((prev) => ({ ...prev, [section]: [...prev[section], { label: presetLabel ?? '', value: '' }] }));
  }

  function removeRow(section: MarketplaceDetailSection, index: number) {
    setRows((prev) => ({ ...prev, [section]: prev[section].filter((_, i) => i !== index) }));
  }

  return (
    <div className="space-y-5 pb-4">
      <p className="text-xs text-gray-400">{t('products.marketplaceIntro')}</p>

      <div className="bg-white border border-gray-100 rounded-xl p-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">{t('products.marketplacePriceLabel')}</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={marketplacePrice}
          onChange={(e) => setMarketplacePrice(e.target.value)}
          placeholder={String(product.sellingPrice)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          {marketplacePrice.trim()
            ? t('products.marketplacePriceHintSet')
            : `${t('products.marketplacePriceHintUnset')} (৳${product.sellingPrice.toFixed(2)})`}
        </p>
      </div>

      <ProductGalleryEditor product={product} t={t} />

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{t('products.youtubeUrlLabel')}</label>
        <input
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder={t('products.youtubeUrlPlaceholder')}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {MARKETPLACE_SECTIONS.map((section) => (
        <div key={section.key} className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-sm font-semibold text-gray-900 mb-2">{t(section.labelKey)}</p>

          {templates.some((tp) => tp.section === section.key) && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1.5">{t('products.pickFromTemplate')}</p>
              <div className="flex flex-wrap gap-1.5">
                {templates
                  .filter((tp) => tp.section === section.key)
                  .map((tp) => {
                    const alreadyAdded = rows[section.key].some((r) => r.label === tp.label);
                    return (
                      <button
                        key={tp.label}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => addRow(section.key, tp.label)}
                        className={`text-xs px-2.5 py-1 rounded-full border ${
                          alreadyAdded
                            ? 'bg-gray-100 text-gray-400 border-gray-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {alreadyAdded ? '✓ ' : '+ '}{tp.label}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {rows[section.key].map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={row.label}
                  onChange={(e) => updateRow(section.key, i, 'label', e.target.value)}
                  placeholder={t('products.detailLabelPlaceholder')}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
                />
                <input
                  value={row.value}
                  onChange={(e) => updateRow(section.key, i, 'value', e.target.value)}
                  placeholder={t('products.detailValuePlaceholder')}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeRow(section.key, i)}
                  className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                  aria-label="Remove row"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => addRow(section.key)} className="text-xs text-indigo-600 font-medium mt-2">
            {t('products.addDetailRow')}
          </button>
        </div>
      ))}

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
      >
        {saveMutation.isPending ? t('products.marketplaceSaving') : t('products.marketplaceSave')}
      </button>
    </div>
  );
}

// ── Product Gallery Editor ───────────────────────────────────────────────────
// Extra marketplace photos beyond the single required product photo — Amazon-style thumbnail
// rail on the public product page. Each action (add/remove/reorder) hits the server immediately
// rather than batching, unlike the label/value detail rows above.

const MAX_GALLERY_IMAGES = 10;

function ProductGalleryEditor({ product, t }: { product: ProductDetail; t: (key: string) => string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const images = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['product', product.id] });

  const addMutation = useMutation({
    mutationFn: (url: string) => addProductImage(product.id, url),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (imageId: string) => removeProductImage(product.id, imageId),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorderProductImages(product.id, ids),
    onSuccess: invalidate,
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      await addMutation.mutateAsync(url);
    } catch (err) {
      toastError(err, t('products.galleryUploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    reorderMutation.mutate(next.map((i) => i.id));
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-sm font-semibold text-gray-900 mb-2">{t('products.galleryLabel')}</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {images.map((img, i) => (
          <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
            <img src={resolveMediaUrl(img.imageUrl) ?? ''} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeMutation.mutate(img.id)}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs leading-none"
              aria-label="Remove photo"
            >
              ×
            </button>
            <div className="absolute bottom-0.5 left-0.5 right-0.5 flex justify-between">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="w-5 h-5 rounded bg-black/60 text-white text-xs disabled:opacity-30"
                aria-label="Move left"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === images.length - 1}
                className="w-5 h-5 rounded bg-black/60 text-white text-xs disabled:opacity-30"
                aria-label="Move right"
              >
                ›
              </button>
            </div>
          </div>
        ))}
        {images.length < MAX_GALLERY_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-20 h-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xl disabled:opacity-50"
          >
            {uploading ? '…' : '+'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <p className="text-xs text-gray-400">{t('products.galleryHint')}</p>
    </div>
  );
}
