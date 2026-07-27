"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { searchProducts } from "@/lib/clientPageApi";
import { useShopContext } from "@/context/ShopContext";
import type { ProductSort } from "@/lib/types";
import ProductCard from "./ProductCard";

const PAGE_SIZE = 40;

export default function ProductGrid({
  q,
  categoryId,
  sort,
  title,
}: {
  q?: string;
  categoryId?: string;
  sort?: ProductSort;
  title?: string;
}) {
  const { shopSlug, isLoading: shopLoading } = useShopContext();

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["clientpage-products", shopSlug, q, categoryId, sort],
    queryFn: ({ pageParam }) => searchProducts(shopSlug, { q, categoryId, sort, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: !shopLoading,
  });

  const products = data?.pages.flatMap((p) => p.items) ?? [];

  if (shopLoading || isLoading) {
    return <div className="p-6 text-center text-sm text-gray-400">Loading products…</div>;
  }

  if (products.length === 0) {
    return <div className="p-6 text-center text-sm text-gray-400">No products found.</div>;
  }

  return (
    <div className="bg-white">
      {title && <h2 className="px-4 lg:px-8 pt-4 text-sm lg:text-base font-semibold text-gray-900">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4 p-3 lg:p-8">
        {products.map((p) => (
          <ProductCard key={p.variantId} product={p} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center pb-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading…" : "See more"}
          </button>
        </div>
      )}
    </div>
  );
}
