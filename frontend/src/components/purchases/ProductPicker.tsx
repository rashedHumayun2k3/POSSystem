'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import SlidePanel from '@/components/ui/SlidePanel';
import BarcodeScanner from '@/components/ui/BarcodeScanner';
import ChipScroller from '@/components/ui/ChipScroller';
import {
  getRecentlyPurchasedProducts,
} from '@/lib/catalogApi';
import {
  searchProductsWithFallback,
  browseProductsWithFallback,
  lookupBarcodeWithFallback,
  getActiveCategoriesWithFallback,
} from '@/lib/localDb/catalogCache';
import type { ProductSearchResult } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';
import { QrCodeIcon } from '@heroicons/react/24/outline';
import { resolveMediaUrl } from '@/lib/media';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (result: ProductSearchResult) => void;
  cartVariantIds?: Set<string>;
  // POS/sale contexts only see the selling price (never cost) and only want sellable stock —
  // purchase-trip callers need the opposite (avg cost visible, out-of-stock items included since
  // they're the ones being restocked). Both default to the original purchase-trip behavior so
  // existing callers are unaffected.
  showSellingPrice?: boolean;
  onlyInStock?: boolean;
  initialQuery?: string;
  // "Recently purchased" means recently bought FROM a supplier — relevant when restocking
  // (purchase trips, supplier returns) but not when selling, so sale-side callers turn it off.
  showRecentlyPurchased?: boolean;
}

// Sentinel for the "All" chip — distinct from `null` (which means "nothing selected yet, still
// auto-picking the first category") and from any real category id (a GUID, so no collision risk).
const ALL_CATEGORY_ID = 'ALL';

// Build A-Z grouped map from a flat list
function buildAzGroups(items: ProductSearchResult[]): Record<string, ProductSearchResult[]> {
  const groups: Record<string, ProductSearchResult[]> = {};
  for (const item of items) {
    const letter = item.productName[0]?.toUpperCase() ?? '#';
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(item);
  }
  return groups;
}

export default function ProductPicker({
  open,
  onClose,
  onSelect,
  cartVariantIds,
  showSellingPrice = false,
  onlyInStock = false,
  initialQuery = '',
  showRecentlyPurchased = true,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLanguage();

  // Reset state when panel opens — pre-seeding with whatever the caller's own search box already
  // had typed in it (e.g. CartPanel's trigger input) so opening this sheet never feels like it
  // discarded what the user just typed.
  useEffect(() => {
    if (open) {
      setSearch(initialQuery);
      setSearchResults([]);
      setSearchError('');
      setScanError('');
      if (initialQuery.trim().length >= 2) handleSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    setScanError('');
    try {
      const result = await lookupBarcodeWithFallback(barcode);
      onSelect(result);
    } catch {
      setScanError(`${t('pickers.barcodeNotFound')}: ${barcode}`);
    }
  };

  // Active categories (only those with ≥1 active product)
  const { data: categories = [] } = useQuery({
    queryKey: ['active-categories'],
    queryFn: getActiveCategoriesWithFallback,
    enabled: open,
    staleTime: 60_000,
  });

  // Default to "All" once categories have loaded and nothing is selected yet
  useEffect(() => {
    if (categories.length > 0 && selectedCategoryId === null && !search) {
      setSelectedCategoryId(ALL_CATEGORY_ID);
    }
  }, [categories, selectedCategoryId, search]);

  // Recently purchased
  const { data: recentlyPurchased = [] } = useQuery({
    queryKey: ['recently-purchased-products'],
    queryFn: () => getRecentlyPurchasedProducts(5),
    enabled: open && showRecentlyPurchased,
  });

  // Browse products in selected category (A-Z) — "All" omits categoryId entirely, same as the
  // unfiltered browse the backend already supports (no pagination on this endpoint; fine for the
  // catalog sizes a reselling shop actually has — revisit if that ever changes).
  const { data: browseResults = [], isLoading: browseLoading } = useQuery({
    queryKey: ['browse-products', selectedCategoryId, onlyInStock],
    queryFn: () => browseProductsWithFallback(
      selectedCategoryId && selectedCategoryId !== ALL_CATEGORY_ID ? selectedCategoryId : undefined,
      onlyInStock
    ),
    enabled: open && !search && selectedCategoryId !== null,
  });

  // Debounced search
  const handleSearch = (q: string) => {
    setSearch(q);
    setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await searchProductsWithFallback(q, onlyInStock);
        setSearchResults(data);
      } catch {
        setSearchError(t('pickers.searchFailed'));
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleSelect = (r: ProductSearchResult) => {
    onSelect(r);
    onClose();
  };

  const handleClose = () => {
    onClose();
    setSearch('');
    setSearchResults([]);
    setSearchError('');
  };

  // Build A-Z groups for browse view
  const azGroups = buildAzGroups(browseResults);
  const azLetters = Object.keys(azGroups).sort();

  // Build A-Z groups for search results
  const searchGroups = buildAzGroups(searchResults);
  const searchLetters = Object.keys(searchGroups).sort();

  const isSearching = search.length >= 2;
  // Guards against a React Query cache hit from another picker instance (same query key) that
  // already fetched this data — `enabled: false` only stops a *new* fetch, it doesn't stop a
  // cached result from a differently-configured caller from showing up here.
  const effectiveRecentlyPurchased = showRecentlyPurchased ? recentlyPurchased : [];
  const recentVariantIds = new Set(effectiveRecentlyPurchased.map((r) => r.variantId));

  return (
    <>
    <SlidePanel open={open} onClose={handleClose} title={t('pickers.chooseProduct')}>
      {/* Search box + scan button */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 pr-9"
              placeholder={t('pickers.searchProduct')}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
          <button
            onClick={() => { setScanError(''); setShowScanner(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shrink-0"
          >
            <QrCodeIcon className="w-4 h-4" />
            {t('pickers.scanBarcode')}
          </button>
        </div>
        {scanError && (
          <p className="text-xs text-red-500 font-medium px-1">{scanError}</p>
        )}
      </div>

      {/* ── Search mode ───────────────────────────────────────────────── */}
      {isSearching && (
        <div className="min-h-[65vh]">
          {searchLoading && (
            <p className="text-sm text-gray-400 text-center py-8">{t('pickers.searching')}</p>
          )}
          {searchError && (
            <p className="text-sm text-red-500 text-center py-6">{searchError}</p>
          )}
          {!searchLoading && !searchError && searchResults.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              {t('pickers.noResults', { query: search })}
            </p>
          )}
          {searchLetters.map((letter) => (
            <div key={letter}>
              <SectionHeader label={letter} />
              {searchGroups[letter].map((r) => (
                <ProductRow key={r.variantId} product={r} onSelect={handleSelect} t={t} inCart={cartVariantIds?.has(r.variantId) ?? false} showSellingPrice={showSellingPrice} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Browse mode ───────────────────────────────────────────────── */}
      {!isSearching && (
        <div className="min-h-[65vh]">
          {/* Category chips — first thing in browse mode (above Recently Purchased), sticky so it
              stays visible while scrolling the list below. */}
          {categories.length > 0 && (
            <ChipScroller
              options={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              allLabel={t('pickers.allCategories')}
              allId={ALL_CATEGORY_ID}
            />
          )}

          {/* Recently purchased */}
          {effectiveRecentlyPurchased.length > 0 && (
            <div>
              <SectionHeader label={t('pickers.recentlyPurchased')} accent />
              {effectiveRecentlyPurchased.map((r) => (
                <ProductRow key={r.variantId} product={r} onSelect={handleSelect} t={t} inCart={cartVariantIds?.has(r.variantId) ?? false} showSellingPrice={showSellingPrice} />
              ))}
            </div>
          )}

          {/* A-Z list within selected category */}
          {browseLoading && (
            <p className="text-sm text-gray-400 text-center py-8">{t('pickers.loading')}</p>
          )}

          {!browseLoading && selectedCategoryId && browseResults.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              {t('pickers.noProductsInCategory')}
            </p>
          )}

          {!browseLoading && azLetters.map((letter) => {
            // Skip products already in "recently purchased" only if that section is visible
            const items = effectiveRecentlyPurchased.length > 0
              ? azGroups[letter].filter((r) => !recentVariantIds.has(r.variantId))
              : azGroups[letter];
            if (items.length === 0) return null;
            return (
              <div key={letter}>
                <SectionHeader label={letter} />
                {items.map((r) => (
                  <ProductRow key={r.variantId} product={r} onSelect={handleSelect} t={t} inCart={cartVariantIds?.has(r.variantId) ?? false} showSellingPrice={showSellingPrice} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </SlidePanel>

    {showScanner && (
      <BarcodeScanner
        onScan={handleBarcodeScan}
        onClose={() => setShowScanner(false)}
        errorMessage={scanError || undefined}
      />
    )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <p className={`px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
      accent ? 'text-indigo-600 bg-indigo-50' : 'text-white bg-orange-800'
    }`}>
      {label}
    </p>
  );
}

function ProductRow({
  product,
  onSelect,
  t,
  inCart,
  showSellingPrice = false,
}: {
  product: ProductSearchResult;
  onSelect: (r: ProductSearchResult) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  inCart: boolean;
  showSellingPrice?: boolean;
}) {
  let variantLabel = '';
  try {
    const vals = JSON.parse(product.variantValuesJson) as Record<string, string>;
    const pairs = Object.values(vals);
    if (pairs.length > 0) variantLabel = pairs.join(' / ');
  } catch {
    // ignore
  }

  // Same "was" vs sellingPrice discount math as the product detail page's Price card.
  const hasDiscount = product.marketPrice != null && product.marketPrice > product.sellingPrice;
  const discountPct = hasDiscount
    ? Math.round(((product.marketPrice! - product.sellingPrice) / product.marketPrice!) * 100)
    : null;

  return (
    <button
      className={`w-full text-left px-4 py-3 border-b transition-colors ${
        inCart
          ? 'bg-indigo-50 border-indigo-100 active:bg-indigo-100'
          : 'bg-gray-50 border-gray-100 active:bg-indigo-50'
      }`}
      onClick={() => onSelect(product)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveMediaUrl(product.imageUrl) ?? ''} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg">📦</span>
            )}
          </div>
          {inCart && (
            <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${inCart ? 'text-indigo-700' : 'text-gray-900'}`}>
              {product.productName}
              {variantLabel && (
                <span className={`font-normal ${inCart ? 'text-indigo-400' : 'text-gray-400'}`}> · {variantLabel}</span>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{product.variantSku}</p>
            {product.barcode && (
              <p className="text-xs text-gray-400">{product.barcode}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] text-gray-300 uppercase tracking-wide leading-none mb-1">{t('pickers.stockPrice')}</p>
          <p className="text-xs text-gray-500">
            {t('pickers.have')}: <span className={product.stock > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>{product.stock}</span>
          </p>
          {showSellingPrice ? (
            <div className="mt-0.5">
              <div className="flex items-baseline gap-1 justify-end flex-wrap">
                {hasDiscount && (
                  <span className="text-[10px] text-gray-400 line-through">৳{product.marketPrice!.toLocaleString()}</span>
                )}
                <span className="text-xs text-indigo-600 font-semibold">৳{product.sellingPrice.toLocaleString()}</span>
              </div>
              {hasDiscount && (
                <span className="inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full">
                  {discountPct}% {t('products.discountOffSuffix')}
                </span>
              )}
            </div>
          ) : product.avgLandedCost > 0 ? (
            <p className="text-xs text-gray-500 mt-0.5">
              {t('pickers.avg')}: <span className="text-indigo-600 font-medium">৳{product.avgLandedCost.toLocaleString()}</span>
            </p>
          ) : (
            <span className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">
              {t('pickers.newBadge')}
            </span>
          )}
          {product.stock <= 5 && (
            <p className="text-[10px] text-red-600 font-medium mt-0.5 max-w-26 leading-tight">
              {t('pickers.lowStockWarning')}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
