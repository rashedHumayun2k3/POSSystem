"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProductCardDto } from "@/lib/types";
import { formatVariantLabel } from "@/lib/variantLabel";
import { buildProductHref } from "@/lib/slug";
import { useShopContext } from "@/context/ShopContext";
import { useCartStore } from "@/store/cartStore";
import { resolveMediaUrl } from "@/lib/media";
import { getDiscountPercent } from "@/lib/discount";
import { hasWholesaleTier } from "@/lib/wholesale";

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProductCard({ product }: { product: ProductCardDto }) {
  const { mode } = useShopContext();
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const variantLabel = formatVariantLabel(product.variantValuesJson);
  const discountPercent = getDiscountPercent(product);
  const isWholesale = hasWholesaleTier(product);

  return (
    <Link
      href={buildProductHref(product.productId, product.name)}
      className="flex flex-col rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-gray-100">
        {product.imageUrl ? (
          <Image src={resolveMediaUrl(product.imageUrl) ?? ''} alt={product.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-xs">No image</div>
        )}
        {!product.inStock && (
          <span className="absolute top-1.5 left-1.5 bg-gray-900/80 text-white text-[10px] px-1.5 py-0.5 rounded">
            Out of stock
          </span>
        )}
        {product.inStock && discountPercent > 0 && (
          <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
            -{discountPercent}%
          </span>
        )}
        {isWholesale && (
          <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
            Wholesale
          </span>
        )}
        {product.inStock && (
          <button
            title="Add to cart"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addItem({
                variantId: product.variantId,
                productId: product.productId,
                name: product.name,
                imageUrl: product.imageUrl,
                price: product.price,
                variantValuesJson: product.variantValuesJson,
                shopId: product.shopId,
                shopName: product.shopName,
              });
              setAdded(true);
              setTimeout(() => setAdded(false), 1200);
            }}
            className={`absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full shadow flex items-center justify-center ${
              added ? "bg-green-600 text-white" : "bg-white text-indigo-600"
            }`}
          >
            {added ? <CheckIcon /> : <PlusIcon />}
          </button>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-0.5 flex-1">
        <span className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[2.5em]">{product.name}</span>
        {variantLabel && <span className="text-xs text-gray-500">{variantLabel}</span>}
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-orange-600">৳{product.price.toFixed(2)}</span>
          {discountPercent > 0 && (
            <span className="text-xs text-gray-400 line-through">৳{product.marketPrice!.toFixed(2)}</span>
          )}
        </span>
        {isWholesale && (
          <span className="text-xs font-medium text-amber-600">
            Buy {product.wholesaleMinQty}+ for ৳{product.wholesaleUnitPrice!.toFixed(2)} each
          </span>
        )}
        {product.reviewCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span className="text-amber-400">★</span>
            {product.averageRating?.toFixed(1)}
            <span className="text-gray-400">({product.reviewCount})</span>
          </span>
        ) : (
          // Always render something here rather than leaving this slot empty — an empty slot
          // makes cards in the same row look inconsistently sized, and "0 reviews" reads as
          // discouraging. A soft invitation instead nudges buyers toward reviewing and signals
          // an active product to the shop owner.
          <span className="text-[11px] text-gray-400 italic">Be the first to review</span>
        )}
        {mode === "marketplace" && (
          <span className="block w-full text-center mt-auto pt-0.5 px-2 py-0.5 rounded-md bg-gray-100 text-[11px] text-gray-500 truncate">
            {product.shopName}
          </span>
        )}
      </div>
    </Link>
  );
}
