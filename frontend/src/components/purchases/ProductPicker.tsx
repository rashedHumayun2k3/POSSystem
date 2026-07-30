'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import SlidePanel from '@/components/ui/SlidePanel';
import BarcodeScanner from '@/components/ui/BarcodeScanner';
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
import { QrCodeIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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
}

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

  // Auto-select first category when categories load and nothing is selected
  useEffect(() => {
    if (categories.length > 0 && selectedCategoryId === null && !search) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId, search]);

  // Category chip row — left/right arrow buttons on top of the horizontal scroller, since on a
  // small phone screen only 2-3 chips fit and swipe-to-scroll isn't obviously discoverable.
  // canScrollLeft/Right gate which arrow renders at all, so an arrow never sits there uselessly
  // once you've scrolled all the way to that end.
  const chipScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollChipsLeft, setCanScrollChipsLeft] = useState(false);
  const [canScrollChipsRight, setCanScrollChipsRight] = useState(false);

  const updateChipScrollState = () => {
    const el = chipScrollRef.current;
    if (!el) return;
    setCanScrollChipsLeft(el.scrollLeft > 4);
    setCanScrollChipsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  // Re-check once the chips have actually laid out (categories arriving async, panel opening) —
  // a rAF instead of running synchronously since scrollWidth isn't reliable until paint.
  useEffect(() => {
    const raf = requestAnimationFrame(updateChipScrollState);
    return () => cancelAnimationFrame(raf);
  }, [categories, open]);

  const scrollChips = (direction: 'left' | 'right') => {
    chipScrollRef.current?.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' });
  };

  // Recently purchased
  const { data: recentlyPurchased = [] } = useQuery({
    queryKey: ['recently-purchased-products'],
    queryFn: () => getRecentlyPurchasedProducts(5),
    enabled: open,
  });

  // Browse products in selected category (A-Z)
  const { data: browseResults = [], isLoading: browseLoading } = useQuery({
    queryKey: ['browse-products', selectedCategoryId, onlyInStock],
    queryFn: () => browseProductsWithFallback(selectedCategoryId ?? undefined, onlyInStock),
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
  const recentVariantIds = new Set(recentlyPurchased.map((r) => r.variantId));

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
        <div>
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
        <div>
          {/* Category chips — first thing in browse mode (above Recently Purchased), sticky so it
              stays visible while scrolling the list below. Arrow buttons only render on whichever
              side still has more to scroll to (see canScrollChipsLeft/Right). */}
          {categories.length > 0 && (
            <div className="border-b border-gray-100 bg-white sticky top-0 z-10">
              <div
                ref={chipScrollRef}
                onScroll={updateChipScrollState}
                className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide"
              >
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      selectedCategoryId === cat.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              {canScrollChipsLeft && (
                <button
                  type="button"
                  onClick={() => scrollChips('left')}
                  aria-label={t('common.scrollLeft')}
                  className="absolute left-0.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center"
                >
                  <ChevronLeftIcon className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
              {canScrollChipsRight && (
                <button
                  type="button"
                  onClick={() => scrollChips('right')}
                  aria-label={t('common.scrollRight')}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow border border-gray-200 flex items-center justify-center"
                >
                  <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
            </div>
          )}

          {/* Recently purchased */}
          {recentlyPurchased.length > 0 && (
            <div>
              <SectionHeader label={t('pickers.recentlyPurchased')} accent />
              {recentlyPurchased.map((r) => (
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
            const items = recentlyPurchased.length > 0
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
      accent ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 bg-gray-50'
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

  return (
    <button
      className={`w-full text-left px-4 py-3 border-b transition-colors ${
        inCart
          ? 'bg-indigo-50 border-indigo-100 active:bg-indigo-100'
          : 'border-gray-50 active:bg-indigo-50'
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
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="text-indigo-600 font-semibold">৳{product.sellingPrice.toLocaleString()}</span>
            </p>
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
