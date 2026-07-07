"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProductCardDto } from "@/lib/types";
import { formatVariantLabel } from "@/lib/variantLabel";
import { buildProductHref } from "@/lib/slug";
import { useShopContext } from "@/context/ShopContext";
import { useCartStore } from "@/store/cartStore";

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

  return (
    <Link
      href={buildProductHref(product.productId, product.name)}
      className="flex flex-col rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-gray-100">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-xs">No image</div>
        )}
        {!product.inStock && (
          <span className="absolute top-1.5 left-1.5 bg-gray-900/80 text-white text-[10px] px-1.5 py-0.5 rounded">
            Out of stock
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
      <div className="p-2.5 flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[2.5em]">{product.name}</span>
        {variantLabel && <span className="text-xs text-gray-500">{variantLabel}</span>}
        <span className="text-sm font-semibold text-indigo-600">৳{product.price.toFixed(2)}</span>
        {mode === "marketplace" && (
          <span className="text-[11px] text-gray-400 truncate">{product.shopName}</span>
        )}
      </div>
    </Link>
  );
}
