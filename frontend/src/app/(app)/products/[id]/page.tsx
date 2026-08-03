'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { getProduct, archiveProduct, setProductMarketplaceVisibility, getPriceSlots, createPriceSlot, activatePriceSlot, deletePriceSlot, downloadBarcodeLabels, updateProduct, updateVariant, addVariant, splitStockIntoVariants, getCategory, getStockAdjustments, adjustStock, recordExistingStockCost, getProductReviews, replyToReview, deleteReviewReply, setReviewHidden, updateMarketplaceDetails, addProductImage, removeProductImage, reorderProductImages, getMarketplaceDetailTemplates, getProductSalesTimeseries } from '@/lib/catalogApi';
import { listOrdersByProduct } from '@/lib/ordersApi';
import { getAppSettings } from '@/lib/settingsApi';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { toastError } from '@/lib/toastError';
import { uploadImage } from '@/lib/media';
import type { Variant, PriceSlot, CategoryField, StockAdjustment, StockAdjustReason, AdminProductReview, ProductDetail, MarketplaceDetailSection, ProductSalesPoint } from '@/types/catalog';
import type { SalesTimeseriesRange } from '@/lib/catalogApi';
import type { OrderListItem } from '@/types/orders';
import { useLanguage } from '@/i18n/LanguageContext';
import StatusBadge from '@/components/ui/StatusBadge';
import { resolveMediaUrl } from '@/lib/media';
import ImageUploadField from '@/components/ui/ImageUploadField';
import ImageLightbox from '@/components/ui/ImageLightbox';
import SlidePanel from '@/components/ui/SlidePanel';
import CustomSelect from '@/components/ui/CustomSelect';
import { usePressAndHold } from '@/hooks/usePressAndHold';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type TabKey = 'info' | 'variants' | 'prices' | 'stock' | 'orders' | 'sales' | 'reviews' | 'marketplace';

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
    ...(canAdjustStock ? [{ key: 'stock' as TabKey, label: t('products.tabStockLabel') }] : []),
    { key: 'orders', label: t('products.tabOrders') },
    // Owner/Manager only — the tab shows Profit, gated server-side too (GTR-10), not just hidden here.
    ...(canAdjustStock ? [{ key: 'sales' as TabKey, label: t('products.tabSales') }] : []),
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
            canAdjustStock={canAdjustStock}
            canManageReviews={canManageReviews}
            t={t}
            onToggleMarketplaceVisibility={(show) => marketplaceVisibilityMutation.mutateAsync(show)}
            marketplaceVisibilityPending={marketplaceVisibilityMutation.isPending}
            onNavigateToTab={setActiveTab}
          />
        )}
        {activeTab === 'variants' && (
          <VariantsTab
            variants={product.variants}
            isOwner={isOwner}
            productId={id}
            categoryId={product.categoryId}
            t={t}
            canAdjustStock={canAdjustStock}
            onSelectForPrice={(v) => {
              setSelectedVariant(v);
              setActiveTab('prices');
            }}
            onSelectForStock={(v) => {
              setSelectedVariant(v);
              setActiveTab('stock');
            }}
          />
        )}
        {activeTab === 'prices' && isOwner && (
          <PricesTab
            product={product}
            variants={product.variants}
            selectedVariant={selectedVariant}
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
        {activeTab === 'sales' && canAdjustStock && (
          <SalesTab productId={id} t={t} />
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

// Icons — small, hand-drawn inline SVGs matching this file's existing convention (no icon
// library import), reused across the sections below.
function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
function AdjustIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m9 6h3.75M16.5 12a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m-9 0h3M7.5 18h9.75M7.5 18a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0" />
    </svg>
  );
}
function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.169.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l4.318-4.318a2.25 2.25 0 000-3.182l-9.581-9.581A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6.75h.008v.008H6V6.75z" />
    </svg>
  );
}
function ShopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m-3 0h13.5l1.125 9A2.25 2.25 0 0117.663 21H6.337a2.25 2.25 0 01-2.212-2.25l1.125-9z" />
    </svg>
  );
}
function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 3v18h18M8 17V9m5 8V5m5 12v-5" />
    </svg>
  );
}

function variantLabel(v: Variant): string {
  const vals = JSON.parse(v.variantValuesJson || '{}') as Record<string, string>;
  return Object.values(vals).filter(Boolean).join(' / ');
}

function deriveOrderPillStatus(order: OrderListItem): 'PAID' | 'DUE' | 'RETURNED' {
  if (order.fulfillmentStatus === 'RETURNED') return 'RETURNED';
  if (order.dueAmount > 0) return 'DUE';
  return 'PAID';
}

function OrderStatusPill({ status, t }: { status: 'PAID' | 'DUE' | 'RETURNED'; t: (key: string) => string }) {
  const styles = {
    PAID: 'bg-green-50 text-green-700',
    DUE: 'bg-amber-50 text-amber-700',
    RETURNED: 'bg-red-50 text-red-700',
  } as const;
  const labels = {
    PAID: t('products.orderStatusPaid'),
    DUE: t('products.orderStatusDue'),
    RETURNED: t('products.orderStatusReturned'),
  } as const;
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// Small "go to another tab" button — same shape/size everywhere it appears (sections 3/4/5/7/8
// plus the Price hero card and the colored Stock banner). `tone` picks the contrast strategy
// ('light' outline for white/light cards, 'dark' translucent-white for the dark Price hero card);
// `accent` picks the hue so the outline reads as part of its card instead of a generic indigo
// button dropped onto a red/amber/green background. Tailwind needs literal class names (not
// template-built ones) to keep them in the production build, hence the lookup map.
const TAB_NAV_ACCENTS = {
  indigo: 'bg-gray-100 border border-gray-200 text-gray-700 active:bg-gray-200',
  red: 'bg-white border border-red-300 text-red-700 active:bg-red-50',
  amber: 'bg-white border border-amber-300 text-amber-700 active:bg-amber-50',
  green: 'bg-white border border-green-300 text-green-700 active:bg-green-50',
} as const;

function TabNavButton({
  icon,
  label,
  onClick,
  tone = 'light',
  accent = 'indigo',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'light' | 'dark';
  accent?: keyof typeof TAB_NAV_ACCENTS;
}) {
  const toneClass = tone === 'dark'
    ? 'bg-white/15 text-white active:bg-white/25'
    : TAB_NAV_ACCENTS[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium shrink-0 ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-gray-100 rounded-2xl p-4">{children}</div>;
}
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs mb-2 ${className ?? 'text-gray-400'}`}>{children}</p>;
}

// Long description/note text starts collapsed (3 lines) with a Show more/less toggle, so a
// wall of text never dominates the section at a glance — only shown at all once the text is
// actually long enough to need it.
const EXPANDABLE_TEXT_THRESHOLD = 120;
function ExpandableText({ text, t }: { text: string; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > EXPANDABLE_TEXT_THRESHOLD;
  return (
    <div>
      <p className={`text-sm text-gray-900 mt-0.5 whitespace-pre-wrap ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-indigo-600 font-medium mt-1"
        >
          {expanded ? t('common.showLess') : t('common.showMore')}
        </button>
      )}
    </div>
  );
}

function InfoTab({
  product,
  isOwner,
  canAdjustStock,
  canManageReviews,
  t,
  onToggleMarketplaceVisibility,
  marketplaceVisibilityPending,
  onNavigateToTab,
}: {
  product: ProductDetail;
  isOwner: boolean;
  canAdjustStock: boolean;
  canManageReviews: boolean;
  t: (key: string) => string;
  onToggleMarketplaceVisibility: (show: boolean) => Promise<unknown>;
  marketplaceVisibilityPending: boolean;
  onNavigateToTab: (tab: TabKey) => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageDeleteConfirm, setShowImageDeleteConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: product.name,
    description: product.description ?? '',
    note: product.note ?? '',
    warrantyDurationValue: product.warrantyDurationValue != null ? String(product.warrantyDurationValue) : '',
    warrantyDurationUnit: product.warrantyDurationUnit ?? 'MONTHS',
  });

  // Every mutation here is a full-replace PUT (backend requires every field), so this builds
  // the complete payload from the current product and layers just the changed field(s) on top —
  // same approach as every other partial-looking edit on this page.
  const buildUpdatePayload = (overrides: Partial<{
    name: string; imageUrl: string | null; description: string | null; note: string | null;
    warrantyDurationValue: number | null; warrantyDurationUnit: string | null;
    wholesaleMinQty: number | null; wholesaleUnitPrice: number | null;
  }>) => {
    if (!product.rowVer) throw new Error('Missing rowVer');
    return {
      categoryId: product.categoryId,
      name: product.name,
      imageUrl: product.imageUrl,
      unitCode: product.unitCode,
      sellingPrice: product.sellingPrice,
      marketPrice: product.marketPrice,
      packagingCostPerUnit: product.packagingCostPerUnit ?? 0,
      lowStockThreshold: product.lowStockThreshold,
      description: product.description,
      note: product.note,
      warrantyDurationValue: product.warrantyDurationValue,
      warrantyDurationUnit: product.warrantyDurationUnit,
      defectNotes: product.defectNotes,
      attributesJson: product.attributesJson,
      status: product.status,
      rowVer: product.rowVer,
      wholesaleMinQty: product.wholesaleMinQty,
      wholesaleUnitPrice: product.wholesaleUnitPrice,
      ...overrides,
    };
  };

  const onUpdateError = (err: unknown) => {
    const e = err as { response?: { status?: number; data?: { message?: string } } };
    const message = e.response?.status === 409 ? t('products.editConflict') : e.response?.data?.message ?? t('products.failedUpdate');
    useToastStore.getState().show(message, 'error');
  };
  const onUpdateSuccess = () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['product', product.id] });
  };

  const imageMutation = useMutation({
    mutationFn: (imageUrl: string | null) => updateProduct(product.id, buildUpdatePayload({ imageUrl })),
    onSuccess: () => {
      onUpdateSuccess();
      setShowImageDeleteConfirm(false);
      useToastStore.getState().show(t('common.saved'));
    },
    onError: onUpdateError,
  });

  const detailsMutation = useMutation({
    mutationFn: () => updateProduct(product.id, buildUpdatePayload({
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      note: editForm.note.trim() || null,
      warrantyDurationValue: editForm.warrantyDurationValue ? parseInt(editForm.warrantyDurationValue) : null,
      warrantyDurationUnit: editForm.warrantyDurationValue ? editForm.warrantyDurationUnit : null,
    })),
    onSuccess: () => {
      onUpdateSuccess();
      useToastStore.getState().show(t('common.saved'));
      setShowEditDialog(false);
    },
    onError: onUpdateError,
  });

  const handlePickImage = () => fileInputRef.current?.click();
  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage(file);
      await imageMutation.mutateAsync(url);
    } catch {
      useToastStore.getState().show(t('products.imageUploadFailed'), 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openEditDialog = () => {
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      note: product.note ?? '',
      warrantyDurationValue: product.warrantyDurationValue != null ? String(product.warrantyDurationValue) : '',
      warrantyDurationUnit: product.warrantyDurationUnit ?? 'MONTHS',
    });
    setShowEditDialog(true);
  };
  const handleSaveDetails = () => {
    if (!editForm.name.trim()) { useToastStore.getState().show(t('products.nameRequired'), 'error'); return; }
    detailsMutation.mutate();
  };

  const [marketplaceTogglePending, setMarketplaceTogglePending] = useState(false);
  const handleMarketplaceToggle = async () => {
    const turningOn = !(product.showOnMarketplace ?? true);
    setMarketplaceTogglePending(true);
    try {
      await onToggleMarketplaceVisibility(turningOn);
      if (turningOn) onNavigateToTab('marketplace');
    } finally {
      setMarketplaceTogglePending(false);
    }
  };

  const totalStock = product.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  const stockStatus: 'OUT' | 'LOW' | 'OK' =
    totalStock <= 0 ? 'OUT' : totalStock < product.lowStockThreshold ? 'LOW' : 'OK';

  const { data: orders = [] } = useQuery<OrderListItem[]>({
    queryKey: ['product-orders', product.id],
    queryFn: () => listOrdersByProduct(product.id),
    staleTime: 30_000,
  });
  const recentOrders = orders.slice(0, 5);

  const { data: reviews = [] } = useQuery<AdminProductReview[]>({
    queryKey: ['product-reviews', product.id],
    queryFn: () => getProductReviews(product.id),
    enabled: canManageReviews,
  });
  const recentReviews = reviews.slice(0, 5);

  // Same chart as the Sales tab (SalesChartCard), fixed to the default 7-day range — no range
  // picker here, that's what "See Details" is for. Owner/Manager only (enabled: canAdjustStock) —
  // the endpoint itself 403s for STAFF (GTR-10: never see cost/profit), so this section is skipped
  // entirely for them rather than firing a request that's guaranteed to fail.
  const { data: salesPoints = [], isLoading: salesLoading } = useQuery({
    queryKey: ['product-sales-timeseries', product.id, '7d'],
    queryFn: () => getProductSalesTimeseries(product.id, '7d'),
    enabled: canAdjustStock,
    staleTime: 30_000,
  });

  const fmtShortDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  return (
    <div className="space-y-4 pb-4">
      {/* Section 1 — Product picture */}
      <div className="relative w-full h-[180px] rounded-2xl bg-gray-100 overflow-hidden border border-gray-100">
        {product.imageUrl ? (
          <button type="button" onClick={() => setViewerOpen(true)} className="w-full h-full block">
            <img src={resolveMediaUrl(product.imageUrl) ?? ''} alt={product.name} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            <span className="text-xs text-gray-400">{t('products.noImage')}</span>
          </div>
        )}

        {isOwner && (
          <div className="absolute top-2.5 right-2.5 flex gap-2">
            <button
              type="button"
              onClick={handlePickImage}
              disabled={uploadingImage}
              aria-label={t('products.changePhoto')}
              className="w-11 h-11 rounded-full bg-white/95 shadow flex items-center justify-center text-gray-700 active:bg-gray-100 disabled:opacity-50"
            >
              {uploadingImage ? (
                <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              ) : (
                <CameraIcon className="w-5 h-5" />
              )}
            </button>
            {product.imageUrl && (
              <button
                type="button"
                onClick={() => setShowImageDeleteConfirm(true)}
                aria-label={t('products.deletePhoto')}
                className="w-11 h-11 rounded-full bg-white/95 shadow flex items-center justify-center text-red-600 active:bg-red-50"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleImageFile(e.target.files?.[0])}
        />
      </div>
      {product.imageUrl && (
        <ImageLightbox open={viewerOpen} onClose={() => setViewerOpen(false)} url={product.imageUrl} title={product.name} />
      )}

      {/* Section 2 — Product details (only editable-in-place section) */}
      <SectionCard>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>{t('products.detailsSectionLabel')}</SectionLabel>
          {isOwner && (
            <button
              type="button"
              onClick={openEditDialog}
              aria-label={t('products.edit')}
              className="w-11 h-11 -mt-2 -mr-2 rounded-full flex items-center justify-center text-indigo-600 active:bg-indigo-50 shrink-0"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400">{t('products.nameLabel')}</p>
            <p className="text-sm text-gray-900 mt-0.5">{product.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">{t('products.descriptionLabel')}</p>
            {product.description ? (
              <ExpandableText text={product.description} t={t} />
            ) : (
              <p className="text-sm text-gray-400 mt-0.5">{t('products.none')}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400">{t('products.note')}</p>
            {product.note ? (
              <ExpandableText text={product.note} t={t} />
            ) : (
              <p className="text-sm text-gray-400 mt-0.5">{t('products.none')}</p>
            )}
          </div>
          {!product.description && !product.note && (
            <p className="text-xs font-medium text-red-600">{t('products.descriptionNoteMissing')}</p>
          )}
          <div className="bg-blue-200 rounded-lg px-3 py-2 text-center">
            <p className="text-sm text-gray-900">
              <span className="text-gray-700">{t('products.warrantyLabelShort')}: </span>
              {product.warrantyDurationValue != null && product.warrantyDurationUnit
                ? `${product.warrantyDurationValue} ${warrantyUnitLabel(product.warrantyDurationUnit, t)}`
                : <span className="text-gray-500">{t('products.noWarranty')}</span>}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Section 3 — Stock — three states instead of the old plain "below threshold" binary:
          OK (comfortably above the low-stock threshold), LOW (below threshold but some left), and
          OUT (zero). Background, label pill, and the action button's own wording all follow
          stockStatus, since "Adjust Stock" reads oddly once there's nothing left to adjust. */}
      {canAdjustStock && (
        <div className={`rounded-2xl p-4 ${
          stockStatus === 'OUT' ? 'bg-red-100' : stockStatus === 'LOW' ? 'bg-amber-100' : 'bg-green-100'
        }`}>
          <SectionLabel className={
            stockStatus === 'OUT' ? 'text-red-700' : stockStatus === 'LOW' ? 'text-amber-700' : 'text-green-700'
          }>
            {t('products.tabStock')}
          </SectionLabel>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[22px] font-medium text-gray-900">
                {totalStock} <span className="text-sm font-normal text-gray-500">{product.unitCode}</span>
              </p>
              <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${
                stockStatus === 'OUT' ? 'bg-red-600' : stockStatus === 'LOW' ? 'bg-amber-600' : 'bg-green-600'
              }`}>
                {stockStatus === 'OUT' && t('products.stockStatusOut')}
                {stockStatus === 'LOW' && t('products.stockStatusLow')}
                {stockStatus === 'OK' && t('products.stockStatusOk')}
              </span>
            </div>
            <TabNavButton
              icon={<AdjustIcon className="w-4 h-4" />}
              label={
                stockStatus === 'OUT' ? t('products.stockRestockNowButton')
                  : stockStatus === 'LOW' ? t('products.stockRestockButton')
                  : t('products.stockAdjustButton')
              }
              onClick={() => onNavigateToTab('stock')}
              accent={stockStatus === 'OUT' ? 'red' : stockStatus === 'LOW' ? 'amber' : 'green'}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('products.lowStockInfo')}: {product.lowStockThreshold} {product.unitCode}</p>
        </div>
      )}

      {/* Section 4 — Variants. Also where the price/offer entry point lives now — since each row
          already shows this variant's own current price, a separate "Current Selling Price" hero
          further down (Section 5, removed) would just be showing the same numbers twice, gated
          only by which variant happened to be the default. "Adjust price" navigates to the
          owner-only Prices tab, same as before, just relocated next to the prices it's editing. */}
      <div className="bg-orange-700 border border-orange-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel className="text-orange-100">{t('products.tabVariants')}</SectionLabel>
          <div className="flex items-center gap-2 shrink-0">
            {isOwner && (
              <TabNavButton
                icon={<TagIcon className="w-3.5 h-3.5" />}
                label={t('products.adjustPriceButton')}
                onClick={() => onNavigateToTab('prices')}
                tone="dark"
              />
            )}
            <TabNavButton
              icon={<AdjustIcon className="w-4 h-4" />}
              label={t('products.changeVariantButton')}
              onClick={() => onNavigateToTab('variants')}
              tone="dark"
            />
          </div>
        </div>
        {product.variants.length === 0 ? (
          <p className="text-sm text-orange-100 py-2">{t('products.noVariants')}</p>
        ) : (
          <div className="divide-y divide-orange-600">
            {product.variants.map((v) => {
              // Own price when this variant overrides it (which is what an active Offer on this
              // variant denormalizes onto — see PriceSlotService.ApplyPriceToVariant), else it's
              // just inheriting the product's base sellingPrice. There's no per-variant market
              // price in the schema, so marketPrice (the shared "was" reference) is compared
              // against THIS variant's own effective price — same discount math as the Price card
              // below, just evaluated per row instead of only for the default variant.
              const effectivePrice = v.priceOverride ?? product.sellingPrice;
              const hasDiscount = product.marketPrice != null && product.marketPrice > effectivePrice;
              const discountPct = hasDiscount
                ? Math.round(((product.marketPrice! - effectivePrice) / product.marketPrice!) * 100)
                : null;
              return (
                <div key={v.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="w-10 h-10 rounded-lg bg-orange-800 shrink-0 overflow-hidden flex items-center justify-center">
                    {v.imageUrl ? (
                      <img src={resolveMediaUrl(v.imageUrl) ?? ''} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-4 h-4 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                      </svg>
                    )}
                  </div>
                  {variantLabel(v) ? (
                    <p className="text-sm text-white flex-1 min-w-0 truncate">{variantLabel(v)}</p>
                  ) : (
                    <p className="text-sm text-orange-200 flex-1 min-w-0 truncate">{product.sku}</p>
                  )}
                  <div className="text-right shrink-0">
                    <div className="flex items-baseline gap-1.5 justify-end flex-wrap">
                      {hasDiscount && (
                        <span className="text-[11px] text-orange-200 line-through">৳{product.marketPrice!.toLocaleString()}</span>
                      )}
                      <span className="text-sm font-semibold text-white">৳{effectivePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      {hasDiscount && (
                        <span
                          className="text-[10px] font-medium rounded"
                          style={{ background: '#EEEBFF', color: '#4A3DBF', padding: '1px 6px' }}
                        >
                          {discountPct}% {t('products.offWord')}
                        </span>
                      )}
                      <span className="text-xs text-orange-100">{v.stock ?? 0} {t('products.inStock')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 6 — Show in marketplace */}
      {isOwner && (
        <div className="bg-orange-200 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <ShopIcon className="w-5 h-5 text-orange-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t('products.showOnMarketplace')}</p>
              <p className="text-xs text-gray-600 mt-0.5">{t('products.showOnMarketplaceDesc')}</p>
            </div>
            <ToggleSwitch
              checked={product.showOnMarketplace ?? true}
              disabled={marketplaceVisibilityPending || marketplaceTogglePending}
              onChange={handleMarketplaceToggle}
            />
          </div>
        </div>
      )}

      {/* Section 7 — Order history (latest 5) */}
      <div className="bg-teal-50 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel className="text-teal-700">{t('products.orderHistoryLatest')}</SectionLabel>
          {orders.length > 5 && (
            <TabNavButton
              icon={<OrdersIcon className="w-4 h-4" />}
              label={t('products.viewAllOrdersButton')}
              onClick={() => onNavigateToTab('orders')}
            />
          )}
        </div>
        {recentOrders.length === 0 ? (
          <div className="text-center py-6">
            <OrdersIcon className="w-8 h-8 text-gray-200 mx-auto mb-1.5" />
            <p className="text-sm text-gray-400">{t('products.noOrdersYet')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentOrders.map((order) => {
              const qty = order.items.filter((i) => i.productId === product.id).reduce((s, i) => s + i.qty, 0);
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 active:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">#{order.orderNo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtShortDate(order.createdAt)} · {qty} {product.unitCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-gray-900">৳{order.totalAmount.toLocaleString()}</span>
                    <OrderStatusPill status={deriveOrderPillStatus(order)} t={t} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 8 — Reviews (latest 5) */}
      {canManageReviews && (
        <div className="bg-pink-50 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <SectionLabel className="text-pink-700">{t('products.reviewsLatest')}</SectionLabel>
              {product.reviewCount > 0 && (
                <p className="flex items-center gap-1 text-sm text-gray-700 -mt-1">
                  <span className="text-amber-400">★</span>
                  <span className="font-medium">{(product.averageRating ?? 0).toFixed(1)}</span>
                  <span className="text-gray-400">({product.reviewCount} {t('products.reviewsWord')})</span>
                </p>
              )}
            </div>
            {reviews.length > 5 && (
              <TabNavButton
                icon={<ChatIcon className="w-4 h-4" />}
                label={t('products.viewAllReviewsButton')}
                onClick={() => onNavigateToTab('reviews')}
              />
            )}
          </div>
          {recentReviews.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{t('products.noReviewsYet')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentReviews.map((r) => (
                <div key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{r.reviewerName}</span>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 9 — Sales summary. The literal same chart as the Sales tab (SalesChartCard),
          fixed to the default 7-day range — no range picker here, that's what "See Details" is
          for; it jumps to the Sales tab where the range can actually be changed. Owner/Manager
          only, matching the Sales tab itself (see canAdjustStock gate on the query above). */}
      {canAdjustStock && (
        <div className="bg-indigo-50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionLabel className="text-indigo-700">{t('products.tabSales')}</SectionLabel>
            <TabNavButton
              icon={<ChartBarIcon className="w-4 h-4" />}
              label={t('products.seeDetailsButton')}
              onClick={() => onNavigateToTab('sales')}
            />
          </div>
          <SalesChartCard points={salesPoints} isLoading={salesLoading} t={t} />
        </div>
      )}

      {/* Image delete confirmation */}
      {showImageDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowImageDeleteConfirm(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <p className="text-base font-semibold text-gray-900 text-center">{t('products.deletePhotoConfirmTitle')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImageDeleteConfirm(false)}
                className="flex-1 h-14 rounded-xl border border-gray-200 text-gray-700 text-base font-semibold"
              >
                {t('common.no')}
              </button>
              <button
                onClick={() => imageMutation.mutate(null)}
                disabled={imageMutation.isPending}
                className="flex-1 h-14 rounded-xl bg-red-500 text-white text-base font-semibold disabled:opacity-50"
              >
                {t('common.yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 2 edit dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditDialog(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <p className="text-base font-semibold text-gray-900">{t('products.detailsSectionLabel')}</p>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.nameLabel')}</label>
              <input
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.descriptionLabel')}</label>
              <textarea
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.note')}</label>
              <textarea
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
                rows={2}
                value={editForm.note}
                onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.warrantyLabel')}</label>
                <input
                  type="number" min="0"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  placeholder={t('products.optional')}
                  value={editForm.warrantyDurationValue}
                  onChange={(e) => setEditForm((f) => ({ ...f, warrantyDurationValue: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">&nbsp;</label>
                <div className="mt-1">
                  <CustomSelect
                    value={editForm.warrantyDurationUnit}
                    onChange={(v) => setEditForm((f) => ({ ...f, warrantyDurationUnit: v }))}
                    options={[
                      { value: 'DAYS', label: t('products.warrantyDays') },
                      { value: 'MONTHS', label: t('products.warrantyMonths') },
                      { value: 'YEARS', label: t('products.warrantyYears') },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowEditDialog(false)}
                disabled={detailsMutation.isPending}
                className="flex-1 h-12 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveDetails}
                disabled={detailsMutation.isPending}
                className="flex-1 h-12 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {detailsMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function warrantyUnitLabel(unit: string, t: (key: string) => string): string {
  switch (unit) {
    case 'DAYS': return t('products.warrantyDays');
    case 'YEARS': return t('products.warrantyYears');
    default: return t('products.warrantyMonths');
  }
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
  canAdjustStock,
  productId,
  categoryId,
  onSelectForPrice,
  onSelectForStock,
  t,
}: {
  variants: Variant[];
  isOwner: boolean;
  canAdjustStock: boolean;
  productId: string;
  categoryId: string;
  onSelectForPrice: (v: Variant) => void;
  onSelectForStock: (v: Variant) => void;
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
  const [newQty, setNewQty] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [showSplitForm, setShowSplitForm] = useState(false);
  const [splitRows, setSplitRows] = useState<{ name: string; values: Record<string, string>; qty: string }[]>([
    { name: '', values: {}, qty: '' },
    { name: '', values: {}, qty: '' },
  ]);
  const qc = useQueryClient();

  // A single, still-undifferentiated variant with real stock on it is the only case this applies
  // to — splitting an already-multi-variant product's stock would mean deciding which existing
  // variant(s) to pull from, which isn't supported.
  const sourceVariant = variants.length === 1 ? variants[0] : null;
  const sourceStock = sourceVariant?.stock ?? 0;
  const needsSplit = sourceVariant != null && sourceStock > 0;
  const splitTotal = splitRows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
  const splitTotalMatches = Math.abs(splitTotal - sourceStock) < 0.0005;

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
        qty: parseFloat(newQty),
        costPrice: parseFloat(newCostPrice),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', productId] });
      setShowAddForm(false);
      setNewName('');
      setNewValues({});
      setNewImageUrl(null);
      setNewNote('');
      setNewPriceOverride('');
      setNewQty('');
      setNewCostPrice('');
    },
    onError: (err: unknown) => toastError(err, t('products.addVariantFailed')),
  });

  const handleAddVariant = () => {
    if (!newQty || parseFloat(newQty) <= 0) { useToastStore.getState().show(t('products.stockValueRequired'), 'error'); return; }
    if (newCostPrice === '' || parseFloat(newCostPrice) < 0) { useToastStore.getState().show(t('products.costRequired'), 'error'); return; }
    addMutation.mutate();
  };

  const splitMutation = useMutation({
    mutationFn: () =>
      splitStockIntoVariants(productId, {
        sourceVariantId: sourceVariant!.id,
        items: splitRows.map((r) => ({
          values: r.name.trim() ? { Name: r.name.trim(), ...r.values } : r.values,
          qty: parseFloat(r.qty),
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', productId] });
      setShowSplitForm(false);
      setSplitRows([{ name: '', values: {}, qty: '' }, { name: '', values: {}, qty: '' }]);
    },
    onError: (err: unknown) => toastError(err, t('products.splitVariantsFailed')),
  });

  const updateSplitRow = (index: number, patch: Partial<{ name: string; values: Record<string, string>; qty: string }>) => {
    setSplitRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addSplitRow = () => setSplitRows((prev) => [...prev, { name: '', values: {}, qty: '' }]);

  const removeSplitRow = (index: number) => setSplitRows((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));

  const handleSplitSubmit = () => {
    if (splitRows.some((r) => !r.qty || parseFloat(r.qty) <= 0)) {
      useToastStore.getState().show(t('products.stockValueRequired'), 'error');
      return;
    }
    if (!splitTotalMatches) {
      useToastStore.getState().show(t('products.splitTotalMismatch'), 'error');
      return;
    }
    splitMutation.mutate();
  };

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
        const label = Object.values(vals).filter(Boolean).join(' / ');

        return (
          <div key={v.id} className="bg-gray-100 border border-gray-200 rounded-xl p-3">
            {isOwner && (
              <div className="mb-3">
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
            <div className="flex items-center justify-between">
              <div>
                {label && <p className="text-sm font-medium text-gray-900">{label}</p>}
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
                <p className="text-xs text-gray-500 mt-0.5">{t('products.stockLabel')}: {v.stock ?? 0}</p>
              </div>
            </div>
            {(isOwner || canAdjustStock) && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {isOwner && (
                  <button
                    onClick={() => onSelectForPrice(v)}
                    className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg"
                  >
                    {t('products.changePriceArrow')}
                  </button>
                )}
                {canAdjustStock && (
                  <button
                    onClick={() => onSelectForStock(v)}
                    className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg"
                  >
                    {t('products.adjustStockArrow')}
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={() => handlePrintOne(v.id)}
                    disabled={printingId === v.id}
                    className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg disabled:opacity-50"
                  >
                    {printingId === v.id ? '…' : '🖨 Label'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {isOwner && !showAddForm && !showSplitForm && (
        <button
          onClick={() => (needsSplit ? setShowSplitForm(true) : setShowAddForm(true))}
          className="w-full border border-dashed border-indigo-300 text-indigo-600 font-medium py-2.5 rounded-xl text-sm"
        >
          {needsSplit ? t('products.splitIntoVariantsBtn') : t('products.addVariantBtn')}
        </button>
      )}

      {isOwner && showSplitForm && sourceVariant && (
        <div className="bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
          <p className="text-sm font-semibold text-indigo-900">{t('products.splitIntoVariantsTitle')}</p>
          <p className="text-xs text-indigo-700">
            {t('products.splitIntoVariantsHint')} <span className="font-semibold">{sourceStock}</span>
          </p>

          {splitRows.map((row, i) => (
            <div key={i} className="bg-white rounded-lg border border-indigo-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">{t('products.variantRowLabel')} {i + 1}</p>
                {splitRows.length > 2 && (
                  <button type="button" onClick={() => removeSplitRow(i)} className="text-xs text-red-500">
                    {t('common.remove')}
                  </button>
                )}
              </div>
              <input
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm"
                placeholder={t('products.variantNameLabel')}
                value={row.name}
                onChange={(e) => updateSplitRow(i, { name: e.target.value })}
              />
              {variantFields.map((field) => (
                <VariantFieldInput
                  key={field.id}
                  field={field}
                  value={row.values[field.name] ?? ''}
                  onChange={(v) => updateSplitRow(i, { values: { ...row.values, [field.name]: v } })}
                />
              ))}
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm"
                placeholder={t('products.splitQtyLabel')}
                value={row.qty}
                onChange={(e) => updateSplitRow(i, { qty: e.target.value })}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addSplitRow}
            className="w-full border border-dashed border-indigo-300 text-indigo-600 text-xs font-medium py-2 rounded-lg"
          >
            {t('products.addAnotherVariantRow')}
          </button>

          <p className={`text-xs font-medium ${splitTotalMatches ? 'text-green-600' : 'text-red-600'}`}>
            {t('products.splitTotalLabel')}: {splitTotal} / {sourceStock}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowSplitForm(false); setSplitRows([{ name: '', values: {}, qty: '' }, { name: '', values: {}, qty: '' }]); }}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSplitSubmit}
              disabled={splitMutation.isPending || !splitTotalMatches}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white disabled:opacity-60"
            >
              {splitMutation.isPending ? t('common.saving') : t('products.splitIntoVariantsSave')}
            </button>
          </div>
        </div>
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

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder={t('products.initialStockLabel')}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              required
            />
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder={t('products.buyPrice')}
              value={newCostPrice}
              onChange={(e) => setNewCostPrice(e.target.value)}
              required
            />
          </div>

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
              onClick={() => { setShowAddForm(false); setNewName(''); setNewValues({}); setNewImageUrl(null); setNewNote(''); setNewPriceOverride(''); setNewQty(''); setNewCostPrice(''); }}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleAddVariant}
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
      <CustomSelect
        triggerClassName="w-full flex items-center justify-between gap-2 border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white text-left"
        value={value}
        onChange={onChange}
        placeholder={`${field.name}…`}
        options={options.map((o) => ({ value: o, label: o }))}
      />
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
  product,
  variants,
  selectedVariant,
  baseSellingPrice,
  marketPrice,
  packagingCostPerUnit,
  t,
}: {
  product: ProductDetail;
  variants: Variant[];
  selectedVariant: Variant | null;
  baseSellingPrice: number;
  marketPrice: number | null;
  packagingCostPerUnit: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [showOfferSheet, setShowOfferSheet] = useState(false);
  const [formOfferPct, setFormOfferPct] = useState(10);
  // Free-typed text for the % input, separate from formOfferPct — a controlled input bound
  // directly to formOfferPct can't be cleared to retype a new number (each backspace that leaves
  // it momentarily invalid snaps straight back). This buffer lets you type freely; it only commits
  // into formOfferPct (clamped 0-90) on blur/Enter — see commitPctText below.
  const [pctText, setPctText] = useState('10');
  const [formLabel, setFormLabel] = useState('');
  const [formPrice, setFormPrice] = useState('');
  // Which of this product's variants are "in scope" right now — drives both the top-of-tab
  // checkbox picker AND which variants a newly created offer gets applied to (no separate
  // selection inside the sheet; whatever's checked here at submit time is what gets it). Seeded
  // from the deep-link variant (arriving via Variants tab's "set price" on one specific variant)
  // when there is one, else defaults to every variant checked — "sometimes the owner wants all of
  // them, sometimes just one" (see the Variants tab onSelectForPrice callback in the parent).
  // Lazy-initialized so it re-seeds correctly each time this tab remounts (it's conditionally
  // rendered by the parent, so switching tabs away and back always gives a fresh mount).
  const [offerVariantIds, setOfferVariantIds] = useState<Set<string>>(
    () => new Set(selectedVariant ? [selectedVariant.id] : variants.map((v) => v.id))
  );
  const [showCostForm, setShowCostForm] = useState(false);
  const [costPerUnit, setCostPerUnit] = useState('');
  const [showEditSellPriceForm, setShowEditSellPriceForm] = useState(false);
  const [editSellPriceValue, setEditSellPriceValue] = useState('');
  const [showRemoveOfferConfirm, setShowRemoveOfferConfirm] = useState(false);
  // Which offer row's Delete confirmation is open — null when none. Tracks the specific slot
  // (rather than a plain boolean) since any of several inactive rows could trigger it.
  const [deleteConfirmSlotId, setDeleteConfirmSlotId] = useState<string | null>(null);
  const [showWholesaleForm, setShowWholesaleForm] = useState(false);
  const [formReason, setFormReason] = useState('');
  // Start/End date+time for the new offer. formStartDate defaults to "now" when the sheet opens
  // but is editable, so an offer can be scheduled to start later — the backend already supports
  // this (EnsureScheduledStateAsync activates it once its StartDate arrives, no background job).
  // endDateOption 'none' means no auto-expiry ("until changed"); 7/30-day presets are relative to
  // formStartDate (not "now"), so a scheduled-for-later offer still runs the right length once it
  // starts. Both are datetime-local input values (local time, "YYYY-MM-DDTHH:mm").
  const [formStartDate, setFormStartDate] = useState('');
  const [endDateOption, setEndDateOption] = useState<'none' | '7' | '30' | 'custom'>('none');
  const [customEndDate, setCustomEndDate] = useState('');
  const [wholesaleOn, setWholesaleOn] = useState(product.wholesaleMinQty != null);
  const [wholesaleMinQty, setWholesaleMinQty] = useState(product.wholesaleMinQty != null ? String(product.wholesaleMinQty) : '');
  const [wholesaleUnitPrice, setWholesaleUnitPrice] = useState(product.wholesaleUnitPrice != null ? String(product.wholesaleUnitPrice) : '');
  const [wholesaleNote, setWholesaleNote] = useState(product.wholesaleNote ?? '');
  const qc = useQueryClient();

  const { data: appSettings } = useQuery({ queryKey: ['app-settings'], queryFn: getAppSettings });
  // Retail-only shops never see the wholesale section — but if a product already has a tier
  // saved (e.g. the shop just switched from Both/Wholesale to Retail-only), still show it so an
  // owner isn't left unable to see or remove an existing tier.
  const showWholesaleOption = (appSettings?.selling_mode ?? 'BOTH') !== 'RETAIL' || product.wholesaleMinQty != null;
  // Wholesale UI hidden for now (owner request) — mutation, validation, and all wholesale state
  // are left intact; this just suppresses the "Set Wholesale Price" button in the New Offer sheet
  // and the read-only "Wholesale" row in the Details panel. Flip back to true to restore both.
  const SHOW_WHOLESALE_UI = false;

  // The single variant whose cost/margin/current-price/offer-history is shown below — the first
  // checked box, in variant order, so this stays defined even with several variants checked;
  // checking just one temporarily previews that variant's own numbers before submitting.
  const active = variants.find((v) => offerVariantIds.has(v.id)) ?? variants[0];

  const { data: slots = [] } = useQuery<PriceSlot[]>({
    queryKey: ['priceSlots', active?.id],
    queryFn: () => getPriceSlots(active.id),
    enabled: !!active,
  });

  // Takes an explicit variantId + price (rather than always reading `active`/formPrice) so
  // handleCreateSubmit can call this once per checked variant in the offer-scope list, each at
  // that variant's own computed price — see handleCreateSubmit. The backend only auto-activates a
  // new slot when it's the very first one ever created for the variant — every Offer after that is
  // created inactive, so it has to be explicitly activated here, but ONLY if it's actually due now:
  // a future-dated (scheduled) offer must stay pending, picked up later by
  // EnsureScheduledStateAsync once its start time arrives, or it'd start charging the discounted
  // price immediately instead of on schedule.
  const createMutation = useMutation({
    mutationFn: async ({ variantId, price, label, startDate, endDate }: { variantId: string; price: number; label: string; startDate: string; endDate: string | null }) => {
      const slot = await createPriceSlot(variantId, {
        label,
        newPrice: price,
        reason: formReason.trim() || null,
        startDate,
        endDate,
      });
      if (new Date(startDate) <= new Date()) {
        await activatePriceSlot(variantId, slot.id);
      }
      return slot;
    },
    onError: (err: unknown) => toastError(err, t('products.failedCreateSlot')),
  });

  const activateMutation = useMutation({
    mutationFn: (slotId: string) => activatePriceSlot(active.id, slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priceSlots', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });

  // Only ever called for an inactive offer — the Delete icon doesn't render on the active row at
  // all, and the backend rejects deleting an active slot too (defense in depth, not just UI).
  const deleteSlotMutation = useMutation({
    mutationFn: (slotId: string) => deletePriceSlot(active.id, slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priceSlots', active.id] });
      setDeleteConfirmSlotId(null);
    },
    onError: (err: unknown) => toastError(err, t('products.failedDeleteSlot')),
  });

  // "Remove Offer" — there's no backend concept of "no slot active" once any slot exists (exactly
  // one is always active), so going back to plain Sell Price means creating+activating a slot for
  // it, same as any other price change (GTR-7: price history is append-only). Label is the literal
  // "Original Price" string — matching what the backend itself hardcodes for its own auto-created
  // bookkeeping slot — so this row is automatically filtered out of the visible Offers list (see
  // offerSlots above) and the Sell Price card's "(offer name)" annotation stops showing, without
  // needing any extra logic beyond what's already there for that backend-created slot. Explicitly
  // activated after creating (same reason as createMutation above) — it's never the first slot
  // ever for the variant at this point, so the backend won't auto-activate it on its own.
  const removeOfferMutation = useMutation({
    mutationFn: async () => {
      const slot = await createPriceSlot(active.id, {
        label: 'Original Price',
        newPrice: offerReferencePrice,
        reason: null,
      });
      await activatePriceSlot(active.id, slot.id);
      return slot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['priceSlots', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
    onError: (err: unknown) => toastError(err, t('products.failedCreateSlot')),
  });

  // Sell Price (the merchant-facing "regular" price shown on the card, separate from Offers) is
  // product.marketPrice, not product.sellingPrice — sellingPrice gets silently overwritten by the
  // backend to mirror whichever PriceSlot is active (see PriceSlotService.ApplyPriceToVariant), so
  // it can't serve as a stable, independently-editable reference. marketPrice is never touched by
  // slot activation, which is exactly what "the price before any discount" needs to be.
  const marketPriceMutation = useMutation({
    mutationFn: (newPrice: number) => {
      if (!product.rowVer) throw new Error('Missing rowVer');
      return updateProduct(product.id, {
        categoryId: product.categoryId,
        name: product.name,
        imageUrl: product.imageUrl,
        unitCode: product.unitCode,
        sellingPrice: product.sellingPrice,
        marketPrice: newPrice,
        packagingCostPerUnit: product.packagingCostPerUnit ?? 0,
        lowStockThreshold: product.lowStockThreshold,
        description: product.description,
        note: product.note,
        warrantyDurationValue: product.warrantyDurationValue,
        warrantyDurationUnit: product.warrantyDurationUnit,
        defectNotes: product.defectNotes,
        attributesJson: product.attributesJson,
        status: product.status,
        rowVer: product.rowVer,
        wholesaleMinQty: product.wholesaleMinQty,
        wholesaleUnitPrice: product.wholesaleUnitPrice,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      useToastStore.getState().show(t('common.saved'));
    },
    onError: (err: unknown) => toastError(err, t('products.failedUpdate')),
  });

  const handleCreateSubmit = async () => {
    if (!formLabel.trim()) { useToastStore.getState().show(t('products.slotLabelRequired'), 'error'); return; }
    const priceNum = parseFloat(formPrice);
    if (!formPrice || priceNum <= 0) { useToastStore.getState().show(t('products.slotPriceRequired'), 'error'); return; }
    if (!formStartDate) { useToastStore.getState().show(t('products.startDateRequired'), 'error'); return; }
    if (endDateOption === 'custom' && !customEndDate) {
      useToastStore.getState().show(t('products.endDateRequired'), 'error');
      return;
    }
    const targetVariants = variants.filter((v) => offerVariantIds.has(v.id));
    if (targetVariants.length === 0) {
      useToastStore.getState().show(t('products.selectAtLeastOneVariant'), 'error');
      return;
    }
    // Single button covers both actions — if the wholesale section was opened, validate and save
    // it first (awaited — see handleWholesaleSave), stopping before creating the offer if it's
    // invalid/failed rather than creating one while silently failing to save wholesale.
    if (showWholesaleForm && !(await handleWholesaleSave())) return;
    // Freeze the discount % into the label right now, using offerReferencePrice as it stands at
    // this exact moment (same reference the slider itself used) — this is the ONLY time the
    // percentage gets computed. The Offers list later just displays this stored text verbatim, so
    // editing Sell Price afterward can never change it. Same percentage is reused for every checked
    // variant below — only the resulting flat price differs per variant's own reference price.
    const pct = Math.round(((offerReferencePrice - priceNum) / offerReferencePrice) * 100);
    const finalLabel = t('products.offerHeading', { pct });
    const startDateObj = new Date(formStartDate);
    // 7/30-day presets run from the chosen start date+time, not from "now" — so a scheduled-for-
    // later offer still runs for the right length once it actually starts.
    const endDate = endDateOption === 'none' ? null
      : endDateOption === '7' ? new Date(startDateObj.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : endDateOption === '30' ? new Date(startDateObj.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(customEndDate).toISOString();

    try {
      for (const v of targetVariants) {
        // An offer at this exact percentage already exists for this variant — rather than creating
        // a duplicate, skip it (this dedupe check only has data loaded for the active variant's own
        // offer list; other variants just get created normally).
        if (v.id === active.id && offerSlots.some((s) => s.label === finalLabel)) continue;
        // Same % off, applied to each variant's OWN reference price (its own override if it has
        // one, else the shared product-level reference) — NOT the same flat price for everyone, so
        // a pricier variant still ends up discounted proportionally rather than forced to match.
        const variantReferencePrice = v.priceOverride ?? offerReferencePrice;
        const variantPrice = Math.round(variantReferencePrice * (1 - formOfferPct / 100) * 100) / 100;
        await createMutation.mutateAsync({
          variantId: v.id,
          price: variantPrice,
          label: finalLabel,
          startDate: startDateObj.toISOString(),
          endDate,
        });
      }
    } catch {
      return; // onError toast already shown per failed call by createMutation's own config
    }

    qc.invalidateQueries({ queryKey: ['priceSlots'] });
    qc.invalidateQueries({ queryKey: ['product'] });
    setShowOfferSheet(false);
    setFormLabel('');
    setFormPrice('');
    setFormReason('');
    setEndDateOption('none');
    setCustomEndDate('');
  };

  const handleOpenOfferSheet = () => {
    setFormLabel(t('products.priceSlotAutoLabel', { n: offerSlots.length + 1 }));
    handleOfferPctChange(existingOfferPct ?? 10);
    setShowWholesaleForm(false);
    setFormStartDate(toLocalDateTimeInputValue(new Date()));
    setEndDateOption('none');
    setCustomEndDate('');
    setShowOfferSheet(true);
  };

  const toggleOfferVariant = (variantId: string) => {
    setOfferVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) next.delete(variantId); else next.add(variantId);
      return next;
    });
  };

  const allOfferVariantsChecked = variants.every((v) => offerVariantIds.has(v.id));
  const toggleAllOfferVariants = () => {
    setOfferVariantIds(allOfferVariantsChecked ? new Set() : new Set(variants.map((v) => v.id)));
  };

  const handleCloseOfferSheet = () => {
    setShowOfferSheet(false);
    setFormLabel('');
    setFormPrice('');
    setFormReason('');
    setFormStartDate('');
    setEndDateOption('none');
    setCustomEndDate('');
    setShowWholesaleForm(false);
  };

  const handleOpenEditSellPrice = () => {
    setEditSellPriceValue(marketPrice != null ? String(marketPrice) : '');
    setShowEditSellPriceForm(true);
  };

  const handleEditSellPriceSubmit = async () => {
    const newPrice = parseFloat(editSellPriceValue);
    if (!editSellPriceValue || isNaN(newPrice) || newPrice <= 0) {
      useToastStore.getState().show(t('products.slotPriceRequired'), 'error');
      return;
    }
    try {
      await marketPriceMutation.mutateAsync(newPrice);
      setShowEditSellPriceForm(false);
      // If an Offer is currently active, its price was frozen relative to the OLD Sell Price and
      // is now out of sync with its own name (e.g. "Offer 10%" no longer means 10% off). Re-derive
      // that same percentage from the label and record a fresh slot at the recalculated price —
      // a new slot, not an edit to the old one, so history stays append-only (GTR-7) while what's
      // actually charged catches up to match the new Sell Price. Silently skipped if the active
      // offer's label isn't in the "N%" format (e.g. it was manually renamed) — nothing to re-derive
      // the percentage from in that case.
      const currentActiveOffer = offerSlots.find(s => s.isActive);
      const pctMatch = currentActiveOffer?.label.match(/(\d+(?:\.\d+)?)%/);
      if (currentActiveOffer && pctMatch) {
        const pct = parseFloat(pctMatch[1]);
        const recomputedPrice = newPrice * (1 - pct / 100);
        if (recomputedPrice > 0) {
          const newSlot = await createPriceSlot(active.id, {
            label: currentActiveOffer.label,
            newPrice: recomputedPrice,
            reason: currentActiveOffer.reason,
          });
          await activatePriceSlot(active.id, newSlot.id);
          qc.invalidateQueries({ queryKey: ['priceSlots', active.id] });
          qc.invalidateQueries({ queryKey: ['product'] });
        }
      }
    } catch {
      // onError toast already shown by the mutation's own config
    }
  };

  // Percentage mode is driven off offerReferencePrice (marketPrice, or baseSellingPrice as a
  // fallback — see above) — moving the slider recomputes formPrice immediately so the same
  // preview/below-cost logic below, and the same createMutation call on submit, work unchanged
  // regardless of which mode was used to get there.
  const handleOfferPctChange = (pct: number) => {
    setFormOfferPct(pct);
    setPctText(String(pct));
    setFormPrice((offerReferencePrice * (1 - pct / 100)).toFixed(2));
  };

  // Commits whatever's currently typed in the % text box — clamped into the slider's own 0-90
  // range, falling back to the last valid percentage if what's typed isn't a usable number (empty,
  // "abc", negative, etc.) rather than letting an invalid offer price go any further.
  const commitPctText = () => {
    const parsed = parseInt(pctText, 10);
    const clamped = isNaN(parsed) ? formOfferPct : Math.min(90, Math.max(0, parsed));
    handleOfferPctChange(clamped);
  };

  const recordCostMutation = useMutation({
    // Quantity is never user-entered here — it's always the variant's current on-hand count, so
    // this action can only ever attach a cost basis to stock that's already correctly recorded,
    // never silently overwrite the count itself (see StockAdjustmentTab's separate, repeatable
    // RECOUNT flow for actually correcting a wrong count).
    mutationFn: () =>
      recordExistingStockCost(active.id, {
        qty: active.stock ?? 0,
        costPerUnit: parseFloat(costPerUnit),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['stockAdjustments', active.id] });
      setCostPerUnit('');
      setShowCostForm(false);
      useToastStore.getState().show(t('common.saved'));
    },
    onError: (err: unknown) => toastError(err, t('products.existingStockCostFailed')),
  });

  const handleCostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!costPerUnit || parseFloat(costPerUnit) < 0) { useToastStore.getState().show(t('products.costRequired'), 'error'); return; }
    recordCostMutation.mutate();
  };

  const wholesaleMutation = useMutation({
    mutationFn: () => {
      if (!product.rowVer) throw new Error('Missing rowVer');
      return updateProduct(product.id, {
        categoryId: product.categoryId,
        name: product.name,
        imageUrl: product.imageUrl,
        unitCode: product.unitCode,
        sellingPrice: product.sellingPrice,
        marketPrice: product.marketPrice,
        packagingCostPerUnit: product.packagingCostPerUnit ?? 0,
        lowStockThreshold: product.lowStockThreshold,
        description: product.description,
        note: product.note,
        warrantyDurationValue: product.warrantyDurationValue,
        warrantyDurationUnit: product.warrantyDurationUnit,
        defectNotes: product.defectNotes,
        attributesJson: product.attributesJson,
        status: product.status,
        rowVer: product.rowVer,
        wholesaleMinQty: wholesaleOn ? parseFloat(wholesaleMinQty) : null,
        wholesaleUnitPrice: wholesaleOn ? parseFloat(wholesaleUnitPrice) : null,
        wholesaleNote: wholesaleOn && wholesaleNote.trim() ? wholesaleNote.trim() : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      useToastStore.getState().show(t('common.saved'));
    },
    onError: (err: unknown) => toastError(err, t('products.failedUpdate')),
  });

  // Returns false on validation failure OR save failure, so the unified "Create Offer" submit
  // (below) can stop before creating a price slot too. Uses mutateAsync (awaited), not mutate —
  // when a default variant's price slot is created/activated, the backend also writes to
  // Product.SellingPrice (see PriceSlotService.ApplyPriceToVariant), the same row this wholesale
  // update touches. Firing both as fire-and-forget mutate() calls races two writes to the same
  // Product row and its rowversion, and whichever commits second gets a false-positive "This
  // record was changed elsewhere" conflict. Awaiting this one first forces the price-slot create
  // to read a fresh row, so the two writes are sequential instead of racing.
  const handleWholesaleSave = async (): Promise<boolean> => {
    if (wholesaleOn) {
      const minQty = parseFloat(wholesaleMinQty);
      const unitPrice = parseFloat(wholesaleUnitPrice);
      if (!wholesaleMinQty || isNaN(minQty) || minQty < 2) {
        useToastStore.getState().show(t('products.wholesaleMinQtyInvalid'), 'error');
        return false;
      }
      if (!wholesaleUnitPrice || isNaN(unitPrice) || unitPrice <= 0) {
        useToastStore.getState().show(t('products.wholesalePriceRequired'), 'error');
        return false;
      }
      if (unitPrice >= baseSellingPrice) {
        useToastStore.getState().show(t('products.wholesalePriceMustBeLower'), 'error');
        return false;
      }
    }
    try {
      await wholesaleMutation.mutateAsync();
      return true;
    } catch {
      return false; // onError toast already shown by the mutation's own config
    }
  };

  const wholesaleMinQtyNum = parseFloat(wholesaleMinQty);
  const wholesaleUnitPriceNum = parseFloat(wholesaleUnitPrice);
  const wholesaleComplete = wholesaleOn && !isNaN(wholesaleMinQtyNum) && wholesaleMinQtyNum >= 2 && !isNaN(wholesaleUnitPriceNum) && wholesaleUnitPriceNum > 0;
  const wholesalePreviewLines = wholesaleComplete
    ? [
        `${t('products.retailWord')}: 1–${wholesaleMinQtyNum - 1} ${t('products.pieceWord')}: ৳${baseSellingPrice} ${t('products.eachWord')}`,
        `${t('products.wholesaleWord')}: ${wholesaleMinQtyNum}+ ${t('products.pieceWord')}: ৳${wholesaleUnitPriceNum} ${t('products.eachWord')}`,
      ]
    : [`${t('products.anyQuantityWord')}: ৳${baseSellingPrice} ${t('products.eachWord')}`];

  const activeSlot = slots.find(s => s.isActive);
  const effectiveSellPrice = activeSlot?.price ?? (active?.priceOverride ?? baseSellingPrice);

  // The backend auto-creates an "Original Price" PriceSlot for every variant at creation time
  // (ProductService.CreateOriginalPriceSlotAsync, so Activation History isn't blank before the
  // first real offer) — that's backend bookkeeping, not something a merchant ever created as an
  // offer, so it's filtered out of this list. Matched against the literal English string the
  // backend always writes (CreateSlotRequest("Original Price", ...) is hardcoded, not localized)
  // rather than t('products.originalPriceLabel') — comparing against the translated string broke
  // this filter whenever the UI language wasn't English, since the stored value never changes with it.
  const offerSlots = slots.filter(s => s.label !== 'Original Price');

  const landedCost = active?.avgLandedCost ?? 0;
  const totalCost = landedCost + packagingCostPerUnit;

  // What the percentage-slider mode discounts from. Prefers marketPrice (Sell Price), but falls
  // back to baseSellingPrice so the slider is still usable on a brand new product that has a sell
  // price but no marketPrice set yet — otherwise the New Offer sheet would offer no percentage
  // mode at all until Sell Price is explicitly filled in first.
  const offerReferencePrice = marketPrice ?? baseSellingPrice;

  // Existing Offer % — discount from offerReferencePrice down to the currently effective price.
  const existingOfferPct = offerReferencePrice > effectiveSellPrice
    ? Math.round(((offerReferencePrice - effectiveSellPrice) / offerReferencePrice) * 100)
    : null;

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

  // datetime-local inputs need "YYYY-MM-DDTHH:mm" in LOCAL time — toISOString() would silently
  // shift the displayed value by the timezone offset, so this builds it from local getters instead.
  const toLocalDateTimeInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const costNotSet = Boolean(active) && (active!.avgLandedCost ?? 0) === 0 && (active!.stock ?? 0) > 0;

  // Shared Buy Cost / Profit rows — always visible under the Sell Price card now (see below), not
  // gated behind a "Details" toggle anymore. The old crossed-out reference price row that used to
  // live here was dropped — the Sell Price card's own headline already shows that (marketPrice
  // crossed out beside the effective price), so repeating it here was redundant.
  const renderPriceDetailRows = (rowPrice: number) => (
    <div className="space-y-1.5">
      {!costNotSet && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-100">{t('products.productBuyCostLabel')}</span>
          <span className="text-xs font-medium text-white">৳{totalCost.toLocaleString()}</span>
        </div>
      )}
      {!costNotSet && rowPrice > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-100">{t('products.profitLabel')}</span>
          <span className="text-xs font-semibold text-emerald-300">
            ৳{(rowPrice - totalCost).toLocaleString()}
          </span>
        </div>
      )}
      {SHOW_WHOLESALE_UI && showWholesaleOption && (
        <div className="flex justify-between items-center py-1">
          <span className="text-[13px] text-gray-500">{t('products.wholesaleWord')}</span>
          {product.wholesaleMinQty != null && product.wholesaleUnitPrice != null ? (
            <span className="text-[13px] text-gray-900">
              ৳{product.wholesaleUnitPrice.toLocaleString()} · {t('products.minWord')} {product.wholesaleMinQty} {t('products.pieceWord')}
            </span>
          ) : (
            <span className="text-[12px] text-gray-500 bg-gray-100 rounded-md px-2 py-0.5">
              {t('products.wholesaleOffLabel')}
            </span>
          )}
        </div>
      )}
      {SHOW_WHOLESALE_UI && showWholesaleOption && product.wholesaleNote && (
        <p className="text-[11px] text-gray-400 pt-0.5">{product.wholesaleNote}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Variant picker — multi-select (not single) since a new offer can target several variants
          at once (see offerVariantIds); the FIRST checked variant is also what "active" scopes
          the cost/margin/current-price/offers-history below to, so checking just one still works
          as a plain single-variant view. "All variants" is a one-tap master toggle for the common
          "same discount everywhere" case. */}
      {variants.length > 1 && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.selectVariant')}</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleAllOfferVariants}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold border transition-colors ${
                allOfferVariantsChecked
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-indigo-200 text-indigo-600 active:bg-indigo-50'
              }`}
            >
              <span className={`w-4 h-4 rounded-[5px] border-2 flex items-center justify-center shrink-0 ${
                allOfferVariantsChecked ? 'border-white' : 'border-indigo-300'
              }`}>
                {allOfferVariantsChecked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {t('products.allVariantsLabel')}
            </button>
            {variants.map((v) => {
              const vals = JSON.parse(v.variantValuesJson || '{}') as Record<string, string>;
              const label = Object.values(vals).filter(Boolean).join(' / ') || 'Default';
              const isChecked = offerVariantIds.has(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleOfferVariant(v.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium border transition-colors ${
                    isChecked
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 active:bg-gray-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-[5px] border-2 flex items-center justify-center shrink-0 ${
                    isChecked ? 'border-white' : 'border-gray-300'
                  }`}>
                    {isChecked && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {costNotSet && !showCostForm && (
        <button
          type="button"
          onClick={() => setShowCostForm(true)}
          className="w-full rounded-xl bg-red-50 border border-red-200 py-2.5 px-3 active:bg-red-100"
        >
          <p className="text-xs font-semibold text-red-600 text-center">{t('products.buyPriceNotSetWarning')}</p>
          <p className="text-[11px] font-medium text-red-500 text-center mt-0.5">
            {t('products.existingStockCostButton', { qty: active?.stock ?? 0 })}
          </p>
        </button>
      )}

      {/* Add Cost for Existing Stock — only offered while this variant has never had real
          purchase cost recorded. Once it does (any real trip received), this disappears for
          good; from then on restocking goes through Purchases like normal, so a real weighted
          average never gets silently wiped by someone clicking this again later. Lives here
          rather than the Stock tab because it only ever sets a cost basis, never a quantity.
          Triggered by tapping the red warning banner above (no separate trigger button). */}
      {costNotSet && showCostForm && (
        <form onSubmit={handleCostSubmit} className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">{t('products.existingStockCostTitle', { qty: active?.stock ?? 0 })}</p>
          <p className="text-xs text-gray-500">{t('products.existingStockCostHint')}</p>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.buyPrice')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              placeholder={t('products.costPerUnitPlaceholder')}
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCostForm(false)}
              disabled={recordCostMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={recordCostMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {recordCostMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      )}

      {/* Sell Price card — dark theme. Headline is effectiveSellPrice (what's actually charged
          right now), with marketPrice crossed out beside it plus the active offer's own frozen
          name badge when a discount applies — matching the "Offer 10%" badge treatment already
          used elsewhere on this card. Buy Cost/Profit sit below a divider, always visible (no
          "Details" toggle anymore — this card intentionally shows everything at a glance). */}
      <div className="rounded-xl bg-gray-500 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-100">{t('products.currentSellingPriceLabel')}</span>
          <button
            type="button"
            onClick={handleOpenEditSellPrice}
            aria-label={t('products.editSellPrice')}
            className="p-1 text-gray-200 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold text-white">৳{effectiveSellPrice.toLocaleString()}</span>
          {marketPrice != null && marketPrice > effectiveSellPrice && (
            <span className="text-sm text-gray-200 line-through">৳{marketPrice.toLocaleString()}</span>
          )}
          {activeSlot && offerSlots.some(s => s.isActive) && (
            <span className="text-xs font-bold bg-orange-800 text-white px-2 py-0.5 rounded-md">
              {activeSlot.label}
            </span>
          )}
        </div>

        {!costNotSet && (
          <div className="border-t border-gray-300 pt-2.5">
            {renderPriceDetailRows(effectiveSellPrice)}
          </div>
        )}
      </div>

      {/* Offers list — active always on top. Separate from Sell Price above on purpose: changing
          the reference price and running a promotional discount are different actions with
          different frequencies, and merging them (as an earlier iteration did) made it unclear
          which number was actually being charged. Each row's own "Details" toggle reveals old
          price / buy price / margin / wholesale for that specific offer. Only real, explicitly
          created Offers ever appear here — the backend's auto-created "Original Price" bookkeeping
          slot is filtered out (see offerSlots above), and nothing synthetic is shown in its place;
          this section simply doesn't render until the "Create Offer" button below has been used. */}
      {offerSlots.length > 0 && (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('products.priceSlots')}</p>
        <div className="space-y-2">
          {/* slot.label is shown verbatim, never recomputed from the current marketPrice — the
              discount % was already frozen into it at creation time (see handleCreateSubmit), so
              an offer's name can't silently drift just because Sell Price gets edited later. */}
          {[...offerSlots].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)).map((slot) => (
              <div
                key={slot.id}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                  slot.isActive ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                } ${(activateMutation.isPending || deleteSlotMutation.isPending) ? 'pointer-events-none opacity-60' : ''}`}
              >
                {/* Radio circle — visual state only now; Apply/Unapply on the right are the
                    actual actions, so this is no longer an interactive input. */}
                <div className="mt-0.5 shrink-0">
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
                    <span className={`text-lg font-bold ${slot.isActive ? 'text-green-700' : 'text-gray-800'}`}>
                      {slot.label}
                    </span>
                    {slot.isActive && (
                      <span className="text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                        {t('products.currentlyUsed')}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${slot.isActive ? 'text-green-800' : 'text-gray-500'}`}>
                    {t('products.newPriceLabel')}: ৳{slot.price.toLocaleString()}
                  </p>
                  {slot.isActive && slot.endDate && (
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      {t('products.activeUntil', { date: fmtDate(slot.endDate) })}
                    </p>
                  )}
                  {slot.reason && (
                    <p className="text-xs text-gray-500 mt-0.5">{slot.reason}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    {t('products.createdBy')} {slot.createdByName} · {fmtDate(slot.createdAt)}
                  </p>
                </div>

                {/* Actions — Apply + Delete for an inactive offer; once applied, only Unapply
                    (reverts to Sell Price, same as the old "Remove Offer" button, now moved here
                    instead of the Sell Price card). No Delete while active — you have to Unapply
                    first, enforced on the backend too, not just by hiding the button. */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {slot.isActive ? (
                    <button
                      type="button"
                      onClick={() => setShowRemoveOfferConfirm(true)}
                      className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5"
                    >
                      {t('products.unapplyButton')}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => activateMutation.mutate(slot.id)}
                        className="text-[13px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5"
                      >
                        {t('products.applyButton')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmSlotId(slot.id)}
                        aria-label={t('products.deleteOfferButton')}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
          ))}
        </div>
      </div>
      )}

      {/* Sheet is opened from the top "Change Price" button — bottom sheet on mobile, centered
          modal on desktop (SlidePanel handles the responsive switch at the md breakpoint). Always
          rendered regardless of whether the Offers list above is showing — the sheet is how you
          create the very first offer too. */}
      <SlidePanel
          open={showOfferSheet}
          onClose={handleCloseOfferSheet}
          title={t('products.newPriceSlot')}
          footer={
            <button
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending || wholesaleMutation.isPending || !formLabel.trim() || !formPrice || parseFloat(formPrice) <= 0}
              className={`w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 text-white ${isBelowCost ? 'bg-red-500' : 'bg-indigo-600'}`}
            >
              {(createMutation.isPending || wholesaleMutation.isPending) ? t('common.saving') : t('products.createSlot')}
            </button>
          }
        >
          <div className="px-4 py-4 space-y-4">
            {/* Offer scope — read-only summary of whatever's checked in the variant picker above
                the tab (see offerVariantIds); selection happens there, not re-asked here, so
                there's only one place controlling which variants this offer will apply to. */}
            {variants.length > 1 && (
              <div className="flex items-center justify-between gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
                <span className="text-xs font-semibold text-indigo-900">{t('products.applyOfferToVariantsTitle')}</span>
                <span className="text-xs font-medium text-indigo-700 text-right">
                  {allOfferVariantsChecked
                    ? t('products.allVariantsLabel')
                    : variants.filter((v) => offerVariantIds.has(v.id)).map((v) => variantLabel(v) || v.sku).join(', ')}
                </span>
              </div>
            )}

            {/* Summary — Buy Price / Sell Price / Discount / Current Price After Discount, using
                the same field names as the Info tab's Product Price section, so the owner sees
                where they're starting from in familiar terms before picking a new price or offer.
                Dark orange so it reads as a distinct "context" block, not editable content. */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">{t('products.currentPriceSlotDetailsTitle')}</p>
              <div className="bg-orange-950 rounded-xl border border-orange-900 p-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-orange-200">{t('products.buyPrice')}</span>
                  <span className="text-xs font-medium text-orange-50">৳{totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-orange-200">{t('products.sellPriceLabel')}</span>
                  <span className="text-xs font-medium text-orange-50">৳{(marketPrice ?? baseSellingPrice).toLocaleString()}</span>
                </div>
                {existingOfferPct !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-200">{t('products.discountLabel')}</span>
                    <span className="text-xs font-medium text-orange-50">{existingOfferPct}%</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-orange-800">
                  <span className="text-xs font-semibold text-orange-100">{t('products.priceAfterDiscount')}</span>
                  <span className="text-sm font-bold text-white">৳{effectiveSellPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Percentage discount off offerReferencePrice (marketPrice, or baseSellingPrice as a
                fallback when Sell Price hasn't been set yet) — the only way to set an Offer's
                price. formPrice still ends up holding the resulting flat price (see
                handleOfferPctChange), which is what actually gets submitted/frozen on create. */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-indigo-900">{t('products.newPriceSlotSectionTitle')}</p>
              <div className="bg-indigo-900 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-indigo-300 font-medium">{t('products.discountLabel')}</span>
                  <span className="text-sm font-bold text-white">
                    ৳{(!isNaN(previewPrice) ? previewPrice : 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={1}
                    value={formOfferPct}
                    onChange={(e) => handleOfferPctChange(parseInt(e.target.value))}
                    className="flex-1 accent-white"
                  />
                  {/* Typed alternative to dragging — the slider can be fiddly to grab precisely on
                      a small screen. Free-typed into pctText, only clamped/applied on blur or
                      Enter (see commitPctText) so mid-edit states (clearing the field, typing a
                      second digit) aren't fought by the controlled input snapping back. */}
                  <div className="flex items-center gap-1 shrink-0 bg-indigo-800 border border-indigo-700 rounded-lg px-2 py-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={90}
                      value={pctText}
                      onChange={(e) => setPctText(e.target.value)}
                      onBlur={commitPctText}
                      onKeyDown={(e) => { if (e.key === 'Enter') { commitPctText(); e.currentTarget.blur(); } }}
                      className="w-9 bg-transparent text-white text-sm font-semibold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs text-indigo-300">%</span>
                  </div>
                </div>
              </div>

              {previewMargin !== null && (
                <div className={`rounded-lg px-2.5 py-1 flex justify-between items-center ${marginBg(previewMargin)}`}>
                  <span className="text-xs text-gray-500">{t('products.profitLabel')}</span>
                  <span className={`text-xs font-bold ${marginColor(previewMargin)}`}>
                    ৳{(previewPrice - totalCost).toLocaleString()}
                  </span>
                </div>
              )}
              {isBelowCost && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-red-700">
                    Below cost — total cost is ৳{totalCost.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Loss of ৳{(totalCost - previewPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per sale.
                  </p>
                </div>
              )}

              {/* Label is auto-generated (Price Slot 1/2/3…), not typed and not shown here —
                  showing it while setting a new price/offer reads as an extra decision to make.
                  It shows up naturally in the Offers list on the tab body once this is saved. */}
              <input
                className="w-full border border-indigo-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                placeholder={t('products.slotReasonPlaceholder')}
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
              />

              {/* Start Date — defaults to now but is editable, so an offer can be scheduled to
                  start later; the backend picks it up automatically once its time arrives (see
                  EnsureScheduledStateAsync — no background job, checked whenever the product is
                  next read). End Date presets (7/30 days) run from THIS date, not from "now". */}
              <div>
                <label className="text-xs font-medium text-indigo-900">{t('products.startDateLabel')}</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full border border-indigo-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>

              {/* End Date — when unset ("No end date"), the offer just stays active until manually
                  changed, same as before this feature existed. */}
              <div>
                <label className="text-xs font-medium text-indigo-900">{t('products.endDateLabel')}</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {(['none', '7', '30', 'custom'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEndDateOption(opt)}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                        endDateOption === opt ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {opt === 'none' && t('products.endDateNone')}
                      {opt === '7' && t('products.endDate7Days')}
                      {opt === '30' && t('products.endDate30Days')}
                      {opt === 'custom' && t('products.endDateCustom')}
                    </button>
                  ))}
                </div>
                {endDateOption === 'custom' && (
                  <input
                    type="datetime-local"
                    min={formStartDate || undefined}
                    className="mt-1.5 w-full border border-indigo-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                )}
              </div>

              {/* Preview — plain-language recap of what was just picked above, since a raw
                  datetime-local value ("2026-08-05T14:30") isn't obviously readable at a glance. */}
              {formStartDate && (
                <div className="bg-orange-200 border border-orange-300 rounded-lg px-3 py-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{t('products.offerActiveFromLabel')}</span>
                    <span className="text-xs font-medium text-gray-800">{fmtDateTime(new Date(formStartDate).toISOString())}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{t('products.offerEndDatePreviewLabel')}</span>
                    <span className="text-xs font-medium text-gray-800">
                      {endDateOption === 'none' && t('products.endDateNone')}
                      {endDateOption === '7' && fmtDateTime(new Date(new Date(formStartDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())}
                      {endDateOption === '30' && fmtDateTime(new Date(new Date(formStartDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString())}
                      {endDateOption === 'custom' && (customEndDate ? fmtDateTime(new Date(customEndDate).toISOString()) : '—')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Wholesale (পাইকারি) tier — single additive tier, retail always still applies below
                WholesaleMinQty. Deliberately NOT a per-sale category toggle — POS resolves retail
                vs wholesale automatically from the cart quantity. Collapsed by default even inside
                this sheet — most price edits have nothing to do with wholesale, so it shouldn't be
                the first thing visible. Its own Save button because it writes to the product record
                (updateProduct), a separate call from creating a price slot above — the two
                shouldn't be forced through one submit. */}
            {SHOW_WHOLESALE_UI && showWholesaleOption && (
              <div className="pt-4 mt-1 border-t border-gray-100">
                {!showWholesaleForm ? (
                  <button
                    type="button"
                    onClick={() => setShowWholesaleForm(true)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-100 border border-amber-300"
                  >
                    <span className="text-sm font-medium text-amber-800">{t('products.setWholesalePriceButton')}</span>
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <div className="bg-gray-200 border border-gray-300 rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t('products.pricingSectionTitle')}</p>
                      <button type="button" onClick={() => setShowWholesaleForm(false)} className="text-gray-400 p-0.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

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
                          className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
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
                          className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
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

                    <p className="text-[11px] text-gray-500">{t('products.wholesaleSavesWithOfferHint')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </SlidePanel>

      {/* Opened from the Sell Price card's "Edit Sell Price" button — same sheet pattern as New
          Offer above, and reuses the exact same "Current Price Slot Details" summary so the owner
          sees the same starting context either way, just with a plain price field instead of a
          percentage slider (this edits marketPrice directly, not a PriceSlot). */}
      <SlidePanel
          open={showEditSellPriceForm}
          onClose={() => setShowEditSellPriceForm(false)}
          title={t('products.editSellPriceSheetTitle')}
          footer={
            <button
              onClick={handleEditSellPriceSubmit}
              disabled={marketPriceMutation.isPending || !editSellPriceValue || parseFloat(editSellPriceValue) <= 0}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 text-white bg-indigo-600"
            >
              {marketPriceMutation.isPending ? t('common.saving') : t('products.editSellPrice')}
            </button>
          }
        >
          <div className="px-4 py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">{t('products.currentPriceSlotDetailsTitle')}</p>
              <div className="bg-orange-950 rounded-xl border border-orange-900 p-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-orange-200">{t('products.buyPrice')}</span>
                  <span className="text-xs font-medium text-orange-50">৳{totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-orange-200">{t('products.sellPriceLabel')}</span>
                  <span className="text-xs font-medium text-orange-50">৳{(marketPrice ?? baseSellingPrice).toLocaleString()}</span>
                </div>
                {existingOfferPct !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-orange-200">{t('products.discountLabel')}</span>
                    <span className="text-xs font-medium text-orange-50">{existingOfferPct}%</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-orange-800">
                  <span className="text-xs font-semibold text-orange-100">{t('products.priceAfterDiscount')}</span>
                  <span className="text-sm font-bold text-white">৳{effectiveSellPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.newSellingPriceLabel')}</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                autoFocus
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                placeholder={t('products.slotPricePlaceholder')}
                value={editSellPriceValue}
                onChange={(e) => setEditSellPriceValue(e.target.value)}
              />
            </div>
          </div>
        </SlidePanel>

      {/* Single edit entry point — everything price-related (new price/offer, wholesale tier)
          opens from here, into the same sheet (see SlidePanel above). Hidden while the buy price
          isn't set (see warning banner near the top): setting a new price/offer against a ৳0 cost
          basis makes the margin and below-cost checks in that sheet meaningless, so resolving the
          cost basis has to come first. */}
      {!costNotSet && (
        <button
          type="button"
          onClick={handleOpenOfferSheet}
          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
        >
          {t('products.changePriceButton')}
        </button>
      )}

      {/* Remove Offer confirmation — same bottom-sheet pattern as the product Delete confirmation
          on this page, since this is also a real, immediate state change (reverts what's actually
          being charged right now), not something to fire on a single accidental tap. */}
      {showRemoveOfferConfirm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRemoveOfferConfirm(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <p className="text-base font-semibold text-red-600">
              {t('products.removeOfferButtonNamed', { label: activeSlot?.label ?? '' })}
            </p>
            <p className="text-sm text-gray-500">{t('products.removeOfferConfirmWarning')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRemoveOfferConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => { removeOfferMutation.mutate(); setShowRemoveOfferConfirm(false); }}
                disabled={removeOfferMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {removeOfferMutation.isPending ? t('common.saving') : t('products.unapplyButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Offer confirmation — permanent (soft-delete on the backend), unlike Unapply which
          just switches what's charged, so this gets its own separate confirmation rather than
          reusing the one above. */}
      {deleteConfirmSlotId && (() => {
        const targetSlot = offerSlots.find(s => s.id === deleteConfirmSlotId);
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirmSlotId(null)} />
            <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
              <p className="text-base font-semibold text-red-600">
                {t('products.deleteOfferConfirmTitle', { label: targetSlot?.label ?? '' })}
              </p>
              <p className="text-sm text-gray-500">{t('products.deleteOfferConfirmWarning')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmSlotId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm"
                >
                  {t('common.close')}
                </button>
                <button
                  onClick={() => deleteConfirmSlotId && deleteSlotMutation.mutate(deleteConfirmSlotId)}
                  disabled={deleteSlotMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {deleteSlotMutation.isPending ? t('common.saving') : t('products.confirmDeleteOffer')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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

// Three distinct actions instead of one ambiguous field — the backend's "SET" mode replaces stock
// with an absolute total (delta = value - currentStock internally), which reads as "increment by
// this much" if the UI doesn't make that explicit. ADD/DEDUCT send DELTA mode (a true relative
// change); only RECOUNT uses SET, since a physical recount genuinely is "here's the new total."
type StockActionMode = 'ADD' | 'DEDUCT' | 'RECOUNT';

const REASONS_BY_MODE: Record<StockActionMode, StockAdjustReason[]> = {
  ADD: ['EXISTING_STOCK', 'FOUND_EXTRA', 'OTHER'],
  DEDUCT: ['DAMAGED', 'LOST_THEFT', 'OTHER'],
  RECOUNT: ['RECOUNT'],
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
  const [actionMode, setActionMode] = useState<StockActionMode | null>(null);
  const [reason, setReason] = useState<StockAdjustReason>('EXISTING_STOCK');
  const [value, setValue] = useState('1');
  const [note, setNote] = useState('');
  const [variantDropdownOpen, setVariantDropdownOpen] = useState(false);
  const qc = useQueryClient();

  // Looked up fresh from the current `variants` prop by id, rather than trusting
  // `selectedVariant` directly — that's a snapshot object captured once in the parent when a
  // variant was picked, so it goes stale the moment the product query refetches (e.g. right after
  // this very form submits) even though `variants` itself is already up to date by then. This is
  // what was making "Current Stock" not update until a full page reload.
  const active = variants.find((v) => v.id === selectedVariant?.id) ?? variants[0];
  const currentStock = active?.stock ?? 0;

  const { data: history = [] } = useQuery<StockAdjustment[]>({
    queryKey: ['stockAdjustments', active?.id],
    queryFn: () => getStockAdjustments(active.id),
    enabled: !!active,
  });

  const closeForm = () => {
    setActionMode(null);
    setValue('1');
    setNote('');
  };

  const openAction = (mode: StockActionMode) => {
    setActionMode(mode);
    setReason(REASONS_BY_MODE[mode][0]);
    setValue(mode === 'RECOUNT' ? String(currentStock) : '1');
    setNote('');
  };

  const enteredValue = parseFloat(value) || 0;
  // What the stock will actually become after this submits — shown live so the number being
  // typed is never ambiguous, regardless of which of the three actions is open.
  const projectedStock =
    actionMode === 'DEDUCT' ? Math.max(0, currentStock - enteredValue)
    : actionMode === 'RECOUNT' ? enteredValue
    : currentStock + enteredValue;

  const adjustMutation = useMutation({
    mutationFn: () => {
      if (actionMode === 'RECOUNT') {
        return adjustStock(active.id, { reason: 'RECOUNT', mode: 'SET', value: enteredValue, note: note.trim() || null });
      }
      const signedValue = actionMode === 'DEDUCT' ? -enteredValue : enteredValue;
      return adjustStock(active.id, { reason, mode: 'DELTA', value: signedValue, note: note.trim() || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stockAdjustments', active.id] });
      qc.invalidateQueries({ queryKey: ['product'] });
      closeForm();
    },
    onError: (err: unknown) => toastError(err, t('products.stockFailed')),
  });

  const handleSubmit = () => {
    if (!value || isNaN(parseFloat(value)) || enteredValue < (actionMode === 'RECOUNT' ? 0 : 1)) {
      useToastStore.getState().show(t('products.stockValueRequired'), 'error');
      return;
    }
    adjustMutation.mutate();
  };

  const minValue = actionMode === 'RECOUNT' ? 0 : 1;
  const decreaseValue = useCallback(() => {
    setValue((v) => String(Math.max(minValue, (parseFloat(v) || 0) - 1)));
  }, [minValue]);
  const increaseValue = useCallback(() => {
    setValue((v) => String((parseFloat(v) || 0) + 1));
  }, []);
  const valueDecreaseHold = usePressAndHold(decreaseValue);
  const valueIncreaseHold = usePressAndHold(increaseValue);

  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Variant selector — a custom dropdown rather than a native <select>. A native select's
          open popup is rendered by the browser/OS itself, not by this component's CSS, and was
          overflowing past the screen edge on mobile; this version is fully width-constrained by
          its own relative wrapper, the same fix already applied to the hawker/night-entry
          category picker. */}
      {variants.length > 1 && (() => {
        const activeLabel = (() => {
          const vals = JSON.parse(active?.variantValuesJson || '{}') as Record<string, string>;
          return Object.values(vals).filter(Boolean).join(' / ') || 'Default';
        })();
        return (
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.selectVariant')}</label>
            <button
              type="button"
              onClick={() => setVariantDropdownOpen((v) => !v)}
              className="mt-1 w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-left"
            >
              <span className="truncate">{activeLabel}</span>
              <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${variantDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {variantDropdownOpen && (
              <>
                <button type="button" onClick={() => setVariantDropdownOpen(false)} className="fixed inset-0 z-40" aria-label="Close" />
                <div className="absolute z-50 top-full left-0 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">
                  {variants.map((v) => {
                    const vals = JSON.parse(v.variantValuesJson || '{}') as Record<string, string>;
                    const label = Object.values(vals).filter(Boolean).join(' / ') || 'Default';
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => { onSelectVariant(v); setVariantDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2.5 text-sm truncate ${v.id === active?.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 active:bg-gray-50'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Current stock */}
      <div className="bg-indigo-50 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">{t('products.stockCurrentLabel')}</p>
          <p className={`text-2xl font-bold ${(active?.stock ?? 0) <= 0 ? 'text-red-600' : 'text-indigo-700'}`}>
            {active?.stock ?? 0}
          </p>
        </div>
        {(active?.stock ?? 0) <= 0 && (
          <p className="text-xs font-medium text-red-600 mt-1 text-right">{t('products.outOfStockMessage')}</p>
        )}
      </div>

      {/* Three explicit actions instead of one ambiguous "change stock" field — Add/Deduct send a
          true relative change (DELTA mode), Recount replaces the total outright (SET mode), and
          each opens the same slide panel pre-configured for that action so there's never a
          question of which direction a typed number moves the stock in. */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => openAction('ADD')}
          className="py-2.5 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
        >
          + {t('products.stockAddButton')}
        </button>
        <button
          type="button"
          onClick={() => openAction('DEDUCT')}
          className="py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200"
        >
          − {t('products.stockDeductButton')}
        </button>
        <button
          type="button"
          onClick={() => openAction('RECOUNT')}
          className="py-2.5 rounded-xl text-sm font-medium bg-indigo-50 text-indigo-600 border border-indigo-200"
        >
          {t('products.stockRecountButton')}
        </button>
      </div>

      <SlidePanel
        open={actionMode !== null}
        onClose={closeForm}
        title={
          actionMode === 'ADD' ? t('products.stockAddTitle')
          : actionMode === 'DEDUCT' ? t('products.stockDeductTitle')
          : t('products.stockRecountTitle')
        }
        footer={
          <button
            type="button"
            onClick={handleSubmit}
            disabled={adjustMutation.isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 disabled:opacity-50"
          >
            {adjustMutation.isPending ? t('products.stockSubmitting') : t('products.stockSubmit')}
          </button>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {actionMode === 'RECOUNT' ? t('products.stockRecountQtyLabel') : t('products.stockQtyLabel')}
            </label>
            <div className="mt-1 flex items-center justify-center gap-3">
              <button
                type="button"
                {...valueDecreaseHold}
                className="shrink-0 w-16 h-16 rounded-full bg-orange-700 text-3xl font-semibold text-white active:bg-orange-800 select-none"
              >
                −
              </button>
              <input
                type="number"
                step="0.01"
                min={minValue}
                inputMode="decimal"
                className="flex-1 min-w-0 text-2xl font-bold text-center border border-gray-200 rounded-2xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button
                type="button"
                {...valueIncreaseHold}
                className="shrink-0 w-16 h-16 rounded-full bg-orange-700 text-3xl font-semibold text-white active:bg-orange-800 select-none"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              {t('products.stockWillBeLabel')}: <span className="font-semibold text-gray-900">{projectedStock}</span>
              <span className="text-gray-400"> ({t('products.stockCurrentLabel')}: {currentStock})</span>
            </p>
          </div>

          {actionMode !== 'RECOUNT' && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('products.stockReasonLabel')}</label>
              <div className="mt-1">
                <CustomSelect
                  value={reason}
                  onChange={(v) => setReason(v as StockAdjustReason)}
                  options={(actionMode ? REASONS_BY_MODE[actionMode] : []).map((r) => ({ value: r, label: t(REASON_KEYS[r]) }))}
                />
              </div>
            </div>
          )}

          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder={t('products.stockNotePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </SlidePanel>

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
                  <span className="text-sm font-semibold text-gray-800">
                    {t(REASON_KEYS[h.reason] ?? 'products.stockReasonOther')}
                  </span>
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

// ── Sales Tab ────────────────────────────────────────────────────────────────
// Units sold over time, combining every channel (POS/Shop and online orders alike — there's no
// separate "POS sale" entity, both are just Order rows with different Channel values) using the
// same "sold order" definition the Dashboard/Sales Summary/P&L already use (OrderFinancials.
// SoldOrderFilter on the backend), so this graph's totals reconcile with what those already show.

const SALES_RANGES: { key: SalesTimeseriesRange; labelKey: string }[] = [
  { key: '7d', labelKey: 'products.salesRange7d' },
  { key: '30d', labelKey: 'products.salesRange30d' },
  { key: '90d', labelKey: 'products.salesRange90d' },
  { key: '180d', labelKey: 'products.salesRange180d' },
];

// Shared by SalesTab and the Info tab's Sales summary card, so both show the literal same chart
// rather than two separately-maintained versions.
function SalesChartCard({
  points,
  isLoading,
  t,
}: {
  points: ProductSalesPoint[];
  isLoading: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const totalQty = points.reduce((sum, p) => sum + p.qty, 0);
  const chartData = points.map((p) => ({
    label: new Date(p.periodStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    qty: p.qty,
  }));

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('products.unitsSoldLabel')}</span>
        <span className="text-lg font-bold text-gray-900">{totalQty.toLocaleString()}</span>
      </div>

      {isLoading ? (
        <div className="h-[200px] bg-gray-100 rounded-xl animate-pulse" />
      ) : totalQty === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">{t('products.noSalesData')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [Number(v ?? 0).toLocaleString(), t('products.unitsSoldLabel')]} labelStyle={{ fontSize: 11 }} />
            <Bar dataKey="qty" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function SalesTab({ productId, t }: { productId: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  const [range, setRange] = useState<SalesTimeseriesRange>('7d');

  const { data: points = [], isLoading } = useQuery({
    queryKey: ['product-sales-timeseries', productId, range],
    queryFn: () => getProductSalesTimeseries(productId, range),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {SALES_RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              range === r.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            {t(r.labelKey)}
          </button>
        ))}
      </div>

      <SalesChartCard points={points} isLoading={isLoading} t={t} />
      <SalesHistoryTable points={points} isLoading={isLoading} t={t} />
    </div>
  );
}

// Per-bucket, per-channel breakdown below the chart — same buckets as the chart itself (one day
// for 7d/30d, one week for 90d/180d), split into one row per channel present in that bucket
// (a single day can span Facebook, Shop, WhatsApp, etc. at once — a single Channel column can't
// represent that on one row). Not a raw per-order list either (that's what Order History is for,
// and 90d/180d could mean 100+ individual orders). Sales-tab-only, unlike SalesChartCard —
// Revenue/Profit here would be redundant on the Info tab's already-compact summary card.
function SalesHistoryTable({
  points,
  isLoading,
  t,
}: {
  points: ProductSalesPoint[];
  isLoading: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const totalQty = points.reduce((sum, p) => sum + p.qty, 0);
  if (isLoading || totalQty === 0) return null;

  const totalRevenue = points.reduce((sum, p) => sum + p.revenue, 0);
  const totalProfit = points.reduce((sum, p) => sum + p.profit, 0);

  // Newest first — matches every other list on this page (Order History, Reviews). Channels
  // within a date come back pre-sorted by qty desc from the API.
  const rows = [...points].reverse().flatMap((p) =>
    p.channels.map((c) => ({ periodStart: p.periodStart, ...c }))
  );

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="pl-4 pr-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('products.salesTableDateColumn')}</th>
            <th className="px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('products.salesTableChannelColumn')}</th>
            <th className="px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right w-10">{t('products.salesTableUnitsColumn')}</th>
            <th className="px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">{t('products.salesTableRevenueColumn')}</th>
            <th className="pl-2 pr-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">{t('products.salesTableProfitColumn')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r, idx) => (
            <tr key={`${r.periodStart}-${r.channel}-${idx}`}>
              <td className="pl-4 pr-2 py-2.5 text-gray-700 whitespace-nowrap">
                {new Date(r.periodStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </td>
              <td className="px-2 py-2.5 text-gray-700">
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                  {CHANNEL_ICONS[r.channel] ?? r.channel}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right text-gray-900 w-10">{r.qty.toLocaleString()}</td>
              <td className="px-2 py-2.5 text-right text-gray-900 whitespace-nowrap">৳{r.revenue.toLocaleString()}</td>
              <td className={`pl-2 pr-4 py-2.5 text-right font-medium whitespace-nowrap ${r.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                ৳{r.profit.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td colSpan={2} className="pl-4 pr-2 py-2.5 text-gray-700">{t('products.salesTableTotalLabel')}</td>
            <td className="px-2 py-2.5 text-right text-gray-900 w-10">{totalQty.toLocaleString()}</td>
            <td className="px-2 py-2.5 text-right text-gray-900 whitespace-nowrap">৳{totalRevenue.toLocaleString()}</td>
            <td className={`pl-2 pr-4 py-2.5 text-right whitespace-nowrap ${totalProfit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              ৳{totalProfit.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
      </div>
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

type DetailRow = { label: string; value: string; placeholder?: string };

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
    queryKey: ['marketplace-detail-templates', product.categoryId],
    queryFn: () => getMarketplaceDetailTemplates(product.categoryId),
  });

  // First time this product's Marketplace tab is opened (no details saved yet), pre-populate
  // each section with the category's curated rows instead of leaving them empty — the seller
  // just fills in values or deletes rows they don't need.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current) return;
    if (product.marketplaceDetails.length > 0) { prefilledRef.current = true; return; }
    if (templates.length === 0) return;

    setRows((prev) => {
      const stillEmpty = (Object.keys(prev) as MarketplaceDetailSection[]).every((s) => prev[s].length === 0);
      if (!stillEmpty) return prev;

      const grouped: Record<MarketplaceDetailSection, DetailRow[]> = { STYLE: [], FEATURES_SPECS: [], ITEM_DETAILS: [] };
      for (const tp of [...templates].sort((a, b) => a.sortOrder - b.sortOrder)) {
        grouped[tp.section].push({ label: tp.label, value: '', placeholder: tp.valuePlaceholder ?? undefined });
      }
      return grouped;
    });
    prefilledRef.current = true;
  }, [templates, product.marketplaceDetails.length]);

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

  function addRow(section: MarketplaceDetailSection, presetLabel?: string, presetPlaceholder?: string | null) {
    setRows((prev) => ({
      ...prev,
      [section]: [...prev[section], { label: presetLabel ?? '', value: '', placeholder: presetPlaceholder ?? undefined }],
    }));
  }

  function removeRow(section: MarketplaceDetailSection, index: number) {
    setRows((prev) => ({ ...prev, [section]: prev[section].filter((_, i) => i !== index) }));
  }

  return (
    <div className="space-y-5 pb-4">
      <p className="text-xs text-gray-400">{t('products.marketplaceIntro')}</p>

      {!product.imageUrl && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          <span>⚠️</span>
          <span>{t('products.missingPhotoMarketplaceWarning')}</span>
        </p>
      )}

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
                        onClick={() => addRow(section.key, tp.label, tp.valuePlaceholder)}
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
                  placeholder={row.placeholder || t('products.detailValuePlaceholder')}
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
