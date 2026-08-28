"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "@/lib/clientPageApi";
import { useShopContext } from "@/context/ShopContext";
import type { ProductSort } from "@/lib/types";
import ProductCard from "./ProductCard";

export default function TossActiveProductSection({
  title,
  sort,
}: {
  title: string;
  sort?: ProductSort;
}) {
  const { shopSlug, isLoading: shopLoading } = useShopContext();
  const { data, isLoading } = useQuery({
    queryKey: ["tossactive-section", shopSlug, sort ?? "lineup"],
    queryFn: () => searchProducts(shopSlug, { sort, page: 1, pageSize: 8 }),
    enabled: !shopLoading,
  });

  const items = data?.items ?? [];
  if (shopLoading || isLoading || items.length === 0) return null;

  return (
    <section className="toss-product-section" id={title.toLowerCase().replace(/\s+/g, "-")}>
      <div className="toss-section-heading">
        <h2>{title}</h2>
        <Link href="/search">VIEW ALL ↗</Link>
      </div>

      <div className="toss-product-grid">
        {items.slice(0, 4).map((product) => (
          <ProductCard key={product.variantId} product={product} />
        ))}
      </div>
    </section>
  );
}
