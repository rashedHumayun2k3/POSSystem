"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { searchProducts } from "@/lib/clientPageApi";
import { useShopContext } from "@/context/ShopContext";
import ProductCard from "./ProductCard";

const PAGE_SIZE = 20;

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function HighRatingSection() {
  const { shopSlug, isLoading: shopLoading } = useShopContext();

  // Own query key (sort: "rating") — the backend now does the rating-threshold filter and
  // ordering itself (against AverageRating, precomputed nightly by IPopularityService for
  // marketplace mode), so this no longer shares a fetch with the plain browse/search grid.
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["clientpage-products", shopSlug, "rating"],
    queryFn: ({ pageParam }) => searchProducts(shopSlug, { sort: "rating", page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: !shopLoading,
  });

  if (shopLoading || isLoading) return null;

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  if (items.length === 0) return null;

  return (
    <div className="bg-white">
      <h2 className="px-4 lg:px-8 pt-4 text-sm lg:text-base font-semibold text-gray-900 flex items-center gap-1.5">
        <span className="text-amber-400">★</span> Top Rated
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4 p-3 lg:p-8">
        {items.map((p) => (
          <ProductCard key={p.variantId} product={p} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center pb-4">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center gap-1 text-sm font-medium text-indigo-600 px-4 py-1.5 rounded-full border border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading…" : "Show More"} <ChevronDownIcon />
          </button>
        </div>
      )}
    </div>
  );
}
