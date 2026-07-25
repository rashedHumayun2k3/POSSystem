'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStockValuationReport } from '@/lib/reportsApi';
import { getCategories } from '@/lib/catalogApi';
import { useMounted } from '@/hooks/useMounted';
import type { StockValuationPreset, StockValuationCategory, StockValuationProduct } from '@/types/reports';

const PRESETS: { key: StockValuationPreset; label: string }[] = [
  { key: 'this_month', label: 'এই মাস' },
  { key: 'last_month', label: 'গত মাস' },
  { key: 'last_3_months', label: 'গত ৩ মাস' },
  { key: 'this_year', label: 'এই বছর' },
  { key: 'custom', label: 'কাস্টম' },
];

type SortMode = 'stockValue' | 'profit' | 'slowMovers';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'stockValue', label: 'স্টক ভ্যালু অনুযায়ী' },
  { key: 'profit', label: 'লাভ অনুযায়ী' },
  { key: 'slowMovers', label: 'স্লো মুভার আগে' },
];

function ChevronIcon({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg className={`${className} transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M2.25 3h1.386c.51 0 .955.343 1.087.836l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.94-4.694 2.436-7.152.083-.415-.238-.798-.662-.798H5.106M7.5 14.25L5.106 5.272M7.5 14.25L5.741 21M6 21h12" />
    </svg>
  );
}

// Green = will clear at the current sales pace within ~6 months; amber = slower than that, or no
// sales at all in range. Hidden entirely when the range is too short for velocity to mean anything.
function velocityBadge(product: StockValuationProduct, showVelocity: boolean) {
  if (!showVelocity) return null;
  const noVelocity = !product.soldPerMonth || product.soldPerMonth <= 0;
  const slow = noVelocity || (product.monthsOfStockLeft != null && product.monthsOfStockLeft > 6);
  return (
    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${slow ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
      {noVelocity ? 'স্থবির' : slow ? 'স্লো' : 'ভালো চলছে'}
    </span>
  );
}

export default function StockValuationReportPage() {
  const mounted = useMounted();
  const [preset, setPreset] = useState<StockValuationPreset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('stockValue');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const isCustom = preset === 'custom';
  const customReady = !isCustom || (!!customFrom && !!customTo);

  const { data, isLoading, error } = useQuery({
    queryKey: ['report-stock-valuation', preset, customFrom, customTo, categoryId],
    queryFn: () =>
      getStockValuationReport({
        preset,
        from: isCustom ? customFrom : undefined,
        to: isCustom ? customTo : undefined,
        categoryId: categoryId || undefined,
      }),
    staleTime: 60_000,
    enabled: mounted && customReady,
  });

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sortedCategories = useMemo<StockValuationCategory[]>(() => {
    if (!data) return [];
    const sortProducts = (products: StockValuationProduct[]) => {
      const arr = [...products];
      if (sortMode === 'stockValue') arr.sort((a, b) => b.stockValue - a.stockValue);
      else if (sortMode === 'profit') arr.sort((a, b) => b.realizedProfit - a.realizedProfit);
      else arr.sort((a, b) => (a.soldPerMonth ?? 0) - (b.soldPerMonth ?? 0));
      return arr;
    };
    return data.categories.map((c) => ({ ...c, products: sortProducts(c.products) }));
  }, [data, sortMode]);

  return (
    <div className="pb-20">
      {/* Header — title comes from the shared AppHeader (see (app)/layout.tsx's titleMap) */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                preset === p.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isCustom && (
          <div className="flex gap-2 mt-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
            />
          </div>
        )}

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
        >
          <option value="">সব ক্যাটাগরি</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {data && (
          <p className="text-[11px] text-gray-400 mt-1.5">
            স্টক: আজ পর্যন্ত · বিক্রি: {data.rangeLabel}
          </p>
        )}
      </div>

      {/* Sticky grand-total strip */}
      {data && (
        <div className="sticky top-0 z-10 bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between text-sm shadow">
          <span>মোট স্টক ভ্যালু: ৳{data.grandStockValue.toLocaleString()}</span>
          <span className={data.grandRealizedProfit > 0 ? '' : 'text-red-200'}>
            লাভ ৳{data.grandRealizedProfit.toLocaleString()}
          </span>
        </div>
      )}

      {/* Sort control */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setSortMode(o.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${
              sortMode === o.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {(!mounted || isLoading) && <div className="text-center text-gray-400 text-sm py-10">লোড হচ্ছে...</div>}
        {error && <div className="text-center text-red-500 text-sm py-10">রিপোর্ট লোড করা যায়নি।</div>}
        {isCustom && !customReady && (
          <div className="text-center text-gray-400 text-sm py-10">শুরু ও শেষ তারিখ নির্বাচন করুন।</div>
        )}
        {data && sortedCategories.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-10">কোনো প্রোডাক্ট পাওয়া যায়নি।</div>
        )}
        {data && sortedCategories.map((cat) => (
          <CategorySection
            key={cat.categoryId}
            category={cat}
            expanded={expandedCategories.has(cat.categoryId)}
            onToggle={() => toggleSet(setExpandedCategories, cat.categoryId)}
            expandedProducts={expandedProducts}
            onToggleProduct={(id) => toggleSet(setExpandedProducts, id)}
            showVelocity={data.showVelocity}
          />
        ))}
      </div>
    </div>
  );
}

function CategorySection({
  category,
  expanded,
  onToggle,
  expandedProducts,
  onToggleProduct,
  showVelocity,
}: {
  category: StockValuationCategory;
  expanded: boolean;
  onToggle: () => void;
  expandedProducts: Set<string>;
  onToggleProduct: (id: string) => void;
  showVelocity: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronIcon className="w-4 h-4 text-gray-400 shrink-0" open={expanded} />
          <span className="text-sm font-semibold text-gray-900 truncate">{category.categoryName}</span>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className="text-sm font-semibold text-gray-900">৳{category.stockValue.toLocaleString()}</p>
          <p className={`text-xs font-medium ${category.realizedProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
            লাভ ৳{category.realizedProfit.toLocaleString()}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {category.products.map((p) => (
            <ProductRow
              key={p.productId}
              product={p}
              expanded={expandedProducts.has(p.productId)}
              onToggle={() => onToggleProduct(p.productId)}
              showVelocity={showVelocity}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductRow({
  product,
  expanded,
  onToggle,
  showVelocity,
}: {
  product: StockValuationProduct;
  expanded: boolean;
  onToggle: () => void;
  showVelocity: boolean;
}) {
  return (
    <div>
      <button type="button" onClick={onToggle} className="w-full px-4 py-3 active:bg-gray-50 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">{product.productName}</p>
          <ChevronIcon className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" open={expanded} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">৳{product.stockValue.toLocaleString()}</span>
            <span className="text-xs text-gray-400">{product.onHandQty} স্টকে</span>
          </div>
          <span className={`text-xs font-medium ${product.realizedProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
            লাভ ৳{product.realizedProfit.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          {velocityBadge(product, showVelocity)}
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <CartIcon className="w-3 h-3" />
            {product.qtySold} বিক্রি হয়েছে
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 bg-gray-50">
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <span className="text-xs text-gray-500">ক্রয় মূল্য</span>
            <span className="text-xs font-medium text-gray-700">৳{product.avgBuyPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <span className="text-xs text-gray-500">গড় বিক্রয় মূল্য</span>
            <span className="text-xs font-medium text-gray-700">৳{product.avgActualSellPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <span className="text-xs text-gray-500">সম্ভাব্য লাভ</span>
            <span className="text-xs font-medium text-gray-700">৳{product.potentialProfit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between col-span-2 sm:col-span-1">
            <span className="text-xs text-gray-500">মোট ক্রয়কৃত</span>
            <span className="text-xs font-medium text-gray-700">{product.totalBoughtQty}</span>
          </div>
          {showVelocity && (
            <div className="flex justify-between col-span-2 sm:col-span-1">
              <span className="text-xs text-gray-500">স্টক থাকবে আরও</span>
              <span className="text-xs font-medium text-gray-700">
                {product.monthsOfStockLeft != null ? `${product.monthsOfStockLeft} মাস` : '—'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
