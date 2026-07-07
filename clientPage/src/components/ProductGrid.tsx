"use client";

import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "@/lib/clientPageApi";
import { useShopContext } from "@/context/ShopContext";
import ProductCard from "./ProductCard";

export default function ProductGrid({
  q,
  categoryId,
  title,
}: {
  q?: string;
  categoryId?: string;
  title?: string;
}) {
  const { shopSlug, isLoading: shopLoading } = useShopContext();

  const { data, isLoading } = useQuery({
    queryKey: ["clientpage-products", shopSlug, q, categoryId],
    queryFn: () => searchProducts(shopSlug, { q, categoryId }),
    enabled: !shopLoading,
  });

  if (shopLoading || isLoading) {
    return <div className="p-6 text-center text-sm text-gray-400">Loading products…</div>;
  }

  if (!data || data.length === 0) {
    return <div className="p-6 text-center text-sm text-gray-400">No products found.</div>;
  }

  return (
    <div className="bg-white">
      {title && <h2 className="px-4 lg:px-8 pt-4 text-sm lg:text-base font-semibold text-gray-900">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4 p-3 lg:p-8">
        {data.map((p) => (
          <ProductCard key={p.variantId} product={p} />
        ))}
      </div>
    </div>
  );
}
