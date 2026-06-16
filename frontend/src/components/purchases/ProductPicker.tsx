'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import SlidePanel from '@/components/ui/SlidePanel';
import {
  searchProducts,
  browseProducts,
  getRecentlyPurchasedProducts,
  getActiveCategories,
} from '@/lib/catalogApi';
import type { ProductSearchResult } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (result: ProductSearchResult) => void;
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

export default function ProductPicker({ open, onClose, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLanguage();

  // Reset state when panel opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setSearchResults([]);
      setSearchError('');
    }
  }, [open]);

  // Active categories (only those with ≥1 active product)
  const { data: categories = [] } = useQuery({
    queryKey: ['active-categories'],
    queryFn: getActiveCategories,
    enabled: open,
    staleTime: 60_000,
  });

  // Auto-select first category when categories load and nothing is selected
  useEffect(() => {
    if (categories.length > 0 && selectedCategoryId === null && !search) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId, search]);

  // Recently purchased
  const { data: recentlyPurchased = [] } = useQuery({
    queryKey: ['recently-purchased-products'],
    queryFn: () => getRecentlyPurchasedProducts(5),
    enabled: open,
  });

  // Browse products in selected category (A-Z)
  const { data: browseResults = [], isLoading: browseLoading } = useQuery({
    queryKey: ['browse-products', selectedCategoryId],
    queryFn: () => browseProducts(selectedCategoryId ?? undefined),
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
        const data = await searchProducts(q);
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
    <SlidePanel open={open} onClose={handleClose} title={t('pickers.chooseProduct')}>
      {/* Search box */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="relative">
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
                <ProductRow key={r.variantId} product={r} onSelect={handleSelect} t={t} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Browse mode ───────────────────────────────────────────────── */}
      {!isSearching && (
        <div>
          {/* Recently purchased */}
          {recentlyPurchased.length > 0 && (
            <div>
              <SectionHeader label={t('pickers.recentlyPurchased')} accent />
              {recentlyPurchased.map((r) => (
                <ProductRow key={r.variantId} product={r} onSelect={handleSelect} t={t} />
              ))}
            </div>
          )}

          {/* Category chips */}
          {categories.length > 0 && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-b border-gray-100 bg-white sticky top-0 z-10">
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
                  <ProductRow key={r.variantId} product={r} onSelect={handleSelect} t={t} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </SlidePanel>
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
}: {
  product: ProductSearchResult;
  onSelect: (r: ProductSearchResult) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
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
      className="w-full text-left px-4 py-3 border-b border-gray-50 active:bg-indigo-50 transition-colors"
      onClick={() => onSelect(product)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {product.productName}
            {variantLabel && (
              <span className="text-gray-400 font-normal"> · {variantLabel}</span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{product.variantSku}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] text-gray-300 uppercase tracking-wide leading-none mb-1">{t('pickers.stockPrice')}</p>
          <p className="text-xs text-gray-500">
            {t('pickers.have')}: <span className={product.stock > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>{product.stock}</span>
          </p>
          {product.avgLandedCost > 0 ? (
            <p className="text-xs text-gray-500 mt-0.5">
              {t('pickers.avg')}: <span className="text-indigo-600 font-medium">৳{product.avgLandedCost.toLocaleString()}</span>
            </p>
          ) : (
            <span className="inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">
              {t('pickers.newBadge')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
