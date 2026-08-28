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

// Ranked by PopularityScore (recent sales volume + review volume/quality), precomputed nightly
// by IPopularityService — never a live per-request calculation. See backend ClientPageCatalogService
// for the sort="popularity" query.
export default function PopularSection() {
  const { shopSlug, isLoading: shopLoading } = useShopContext();

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["clientpage-products", shopSlug, "popularity"],
    queryFn: ({ pageParam }) => searchProducts(shopSlug, { sort: "popularity", page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: !shopLoading,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

    return (
      <div className="bg-white">
      <div className="toss-section-heading px-4 lg:px-8">
        <h2 className="toss-promo-type">Popular Products</h2>
      </div>
      <div className="toss-popular-grid">
        {shopLoading || isLoading ? (
          <div className="col-span-full px-4 py-8 text-center text-gray-500">
            Loading products...
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full px-4 py-8 text-center text-gray-500">
            No popular products found.
          </div>
        ) : (
          items.map((p) => <ProductCard key={p.variantId} product={p} />)
        )}
      </div>
      {!shopLoading && !isLoading && hasNextPage && (
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
