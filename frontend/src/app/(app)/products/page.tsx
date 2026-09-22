'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProducts } from '@/lib/catalogApi';
import { getCategories } from '@/lib/catalogApi';
import { lookupBarcodeWithFallback } from '@/lib/localDb/catalogCache';
import { useAuthStore } from '@/store/authStore';
import type { ProductSummary } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';
import { resolveMediaUrl } from '@/lib/media';
import ProductSearchScanBar from '@/components/catalog/ProductSearchScanBar';
import CategoryChipFilter from '@/components/catalog/CategoryChipFilter';

const ALL_CATEGORY_ID = 'ALL';

export default function ProductsPage() {
  const router = useRouter();
  const canSeeCosts = useAuthStore((s) => s.canSeeCosts());
  const isOwner = useAuthStore((s) => s.isOwner());
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  const { lang, t } = useLanguage();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORY_ID);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', statusFilter, categoryFilter, search, currentBranchId],
    queryFn: () =>
      getProducts({
        status: statusFilter || undefined,
        categoryId: categoryFilter !== ALL_CATEGORY_ID ? categoryFilter : undefined,
        q: search || undefined,
      }),
  });

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    setScanError('');
    try {
      const result = await lookupBarcodeWithFallback(barcode, currentBranchId ?? undefined);
      router.push(`/products/${result.productId}`);
    } catch {
      setScanError(`${t('pickers.barcodeNotFound')}: ${barcode}`);
    }
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900">{t('products.title')}</h1>
          {isOwner && (
            <div className="flex items-center gap-2">
              <Link
                href="/more/purchases/new"
                className="flex items-center gap-1 bg-white border border-indigo-200 text-indigo-600 text-sm font-medium px-3 py-1.5 rounded-lg"
              >
                <span className="text-base leading-none">+</span> {t('dashboard.newPurchase')}
              </Link>
              <Link
                href="/products/new"
                className="flex items-center gap-1 bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
              >
                <span className="text-base leading-none">+</span> {t('products.new')}
              </Link>
            </div>
          )}
        </div>

        <ProductSearchScanBar
          value={search}
          onChange={setSearch}
          placeholder={t('pickers.searchProduct')}
          scanLabel={t('pickers.scanBarcode')}
          scannerOpen={showScanner}
          onOpenScanner={() => { setScanError(''); setShowScanner(true); }}
          onCloseScanner={() => setShowScanner(false)}
          onScan={handleBarcodeScan}
          error={scanError}
        />
      </div>

      <CategoryChipFilter
        selectedId={categoryFilter}
        onSelect={setCategoryFilter}
        allLabel={t('pickers.allCategories')}
        allId={ALL_CATEGORY_ID}
        categories={categories}
        lang={lang}
      />

      {/* Product list */}
      <div className="px-4 pt-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
              />
            </svg>
            <p className="text-sm">
              {t('products.noProducts')}{' '}
              {isOwner && (
                <Link href="/products/new" className="text-indigo-600 font-medium">
                  {t('products.newProduct')}
                </Link>
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} canSeeCosts={canSeeCosts} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VariantsChipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M6 6.75L12 3l6 3.75M6 6.75L12 10.5m-6-3.75v10.5L12 21m0-10.5l6-3.75M12 10.5V21m6-14.25v10.5L12 21" />
    </svg>
  );
}
function StoreChipIcon({ className, off }: { className?: string; off?: boolean }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m-3 0h13.5l1.125 9A2.25 2.25 0 0117.663 21H6.337a2.25 2.25 0 01-2.212-2.25l1.125-9z" />
      {off && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3l18 18" />}
    </svg>
  );
}
function InfoChip({ children, tone }: { children: React.ReactNode; tone?: 'marketplace-on' | 'marketplace-off' }) {
  const toneClasses =
    tone === 'marketplace-on'
      ? 'bg-[#EEEDFE] text-[#534AB7]'
      : tone === 'marketplace-off'
        ? 'bg-gray-100 text-gray-500'
        : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${toneClasses}`}>
      {children}
    </span>
  );
}

function ProductCard({
  product,
  canSeeCosts,
  t,
}: {
  product: ProductSummary;
  canSeeCosts: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  // Left accent bar, not a full-row tint — a whole-card red/pink background reads fine for one
  // item, but a list with several low-stock products at once turns into a wall of color that
  // stops drawing the eye to anything (and fights the price/name text for contrast). A colored
  // edge stays scannable down the whole list while keeping the row's own content at full
  // legibility — same pattern as Trello labels / most inventory dashboards.
  const isOutOfStock = product.totalStock <= 0;
  const isLowStock = !isOutOfStock && product.totalStock < product.lowStockThreshold;
  const accentBorder = isOutOfStock
    ? 'border-l-4 border-l-red-500'
    : isLowStock
      ? 'border-l-4 border-l-amber-400'
      : 'border-l border-l-gray-100';

  const hasDiscount = product.marketPrice != null && product.marketPrice > product.sellingPrice;
  const discountPct = hasDiscount
    ? Math.round(((product.marketPrice! - product.sellingPrice) / product.marketPrice!) * 100)
    : 0;

  // Some product names carry a baked-in "(32% Off)" suffix (seed/demo data) — the price line
  // below already shows the real, live discount, so strip the redundant duplicate from the name.
  const displayName = product.name.replace(/\s*\(\s*\d+%\s*off\s*\)\s*$/i, '').trim();

  return (
    <Link href={`/products/${product.id}`} className="block">
      <div className={`bg-gray-100 rounded-xl overflow-hidden shadow shadow-gray-400/40 active:shadow-sm transition-shadow ${accentBorder}`}>
        {/* Layer 1 — image, name, status, price line */}
        <div className="p-3 flex gap-3">
          <div className="w-[60px] h-[60px] rounded-[10px] bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
            {product.imageUrl ? (
              <img src={resolveMediaUrl(product.imageUrl) ?? ''} alt={product.name} className="w-full h-full object-center" />
            ) : (
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
                />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-medium text-gray-900 truncate">{displayName}</p>
              <StatusBadge status={product.status} t={t} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {product.sku} · {product.categoryName}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
              <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-[10px] font-medium text-gray-500">{t('products.sellPriceLabel')}</span>
                <span className="text-lg font-bold text-gray-900">৳{product.sellingPrice.toLocaleString()}</span>
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xs text-gray-400 line-through">৳{product.marketPrice!.toLocaleString()}</span>
                  <span className="text-xs font-medium text-green-600">
                    {discountPct}% {t('products.discountOffSuffix')}
                  </span>
                </>
              )}
            </div>
            {(isOutOfStock || isLowStock) && (
              <p className={`text-xs font-medium mt-1 ${isOutOfStock ? 'text-red-600' : 'text-amber-600'}`}>
                {isOutOfStock ? t('products.outOfStockMessage') : t('products.lowStockMessage')}
              </p>
            )}
          </div>
        </div>

        {/* Layer 2 — info chips */}
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          {canSeeCosts && product.buyPrice != null && (
            <InfoChip>{t('products.buyPriceChipLabel')}: ৳{product.buyPrice.toLocaleString()}</InfoChip>
          )}
          <InfoChip>
            <VariantsChipIcon className="w-3 h-3" />
            {product.variantCount} {product.variantCount !== 1 ? t('products.variantsLabel') : t('products.variantLabel')} · {product.totalStock} {product.unitCode}
          </InfoChip>
          <InfoChip tone={product.showOnMarketplace ? 'marketplace-on' : 'marketplace-off'}>
            <StoreChipIcon className="w-3 h-3" off={!product.showOnMarketplace} />
            {product.showOnMarketplace ? t('products.marketplaceListedChip') : t('products.marketplaceNotListedChip')}
          </InfoChip>
        </div>

      </div>
    </Link>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const colors =
    status === 'ACTIVE'
      ? 'bg-green-50 text-green-700'
      : 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${colors}`}>
      {status === 'ACTIVE' ? t('products.active') : t('products.archived')}
    </span>
  );
}
