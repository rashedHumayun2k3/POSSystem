"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getRelatedProducts } from "@/lib/clientPageApi";
import { useShopContext } from "@/context/ShopContext";
import { buildProductHref } from "@/lib/slug";
import { formatVariantLabel } from "@/lib/variantLabel";
import type { ProductCardDto } from "@/lib/types";
import { resolveMediaUrl } from "@/lib/media";

// A compact row (small thumbnail + name/price) rather than the full square ProductCard used in
// grids — this list sits in a narrow sidebar, so a small thumbnail lets many more items fit
// without scrolling than a grid of large square cards would.
function RelatedProductRow({ product }: { product: ProductCardDto }) {
  const variantLabel = formatVariantLabel(product.variantValuesJson);

  return (
    <Link
      href={buildProductHref(product.productId, product.name)}
      className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-gray-50"
    >
      <div className="relative w-12 h-12 shrink-0 rounded-md overflow-hidden bg-gray-100">
        {product.imageUrl ? (
          <Image src={resolveMediaUrl(product.imageUrl) ?? ''} alt={product.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-[9px]">No image</div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs font-medium text-gray-900 line-clamp-2">{product.name}</span>
        {variantLabel && <span className="text-[11px] text-gray-500 truncate">{variantLabel}</span>}
        <span className="text-sm font-bold text-orange-600">৳{product.price.toFixed(2)}</span>
      </div>
    </Link>
  );
}

export default function RelatedProducts({ productId }: { productId: string }) {
  const { shopSlug, isLoading: shopLoading } = useShopContext();
  const { data } = useQuery({
    queryKey: ["clientpage-related-products", shopSlug, productId],
    queryFn: () => getRelatedProducts(shopSlug, productId),
    enabled: !shopLoading && !!productId,
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="lg:w-72 lg:shrink-0">
      <h2 className="text-sm lg:text-base font-semibold text-gray-900 px-4 lg:px-0 pt-4 lg:pt-0">Related Products</h2>
      <div className="flex flex-col gap-1 p-4 lg:p-0 lg:mt-2">
        {data.map((p) => (
          <RelatedProductRow key={p.variantId} product={p} />
        ))}
      </div>
    </div>
  );
}
