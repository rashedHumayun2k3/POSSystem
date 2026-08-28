"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProductCardDto } from "@/lib/types";
import { formatVariantLabel } from "@/lib/variantLabel";
import { buildProductHref } from "@/lib/slug";
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

const DEFAULT_PRODUCT_IMAGE = "/images/default-product.png";

export default function ProductCard({ product }: { product: ProductCardDto }) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const [imageSrc, setImageSrc] = useState(
    () => resolveMediaUrl(product.imageUrl) ?? DEFAULT_PRODUCT_IMAGE
  );
  const variantLabel = formatVariantLabel(product.variantValuesJson);
  const discountPercent = getDiscountPercent(product);
  const isWholesale = hasWholesaleTier(product);

  return (
    <Link
      href={buildProductHref(product.productId, product.name)}
      className="group product block overflow-hidden rounded border border-gray-300 bg-gray-50 transition-shadow hover:shadow-md"
    >
      <div className="toss-product-image aspect-[4/5] h-auto">
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          className="object-contain bg-white transition duration-500 group-hover:scale-105"
          unoptimized
          onError={() => setImageSrc(DEFAULT_PRODUCT_IMAGE)}
        />
        {!product.inStock && (
          <span className="absolute right-2 top-2 bg-gray-900/80 px-2 py-1 text-[9px] tracking-[0.12em] text-white">
            Out of stock
          </span>
        )}
        {product.inStock && discountPercent > 0 && (
          <span className="absolute left-2 top-2 bg-[var(--toss-red)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
            -{discountPercent}%
          </span>
        )}
        {isWholesale && (
          <span className="absolute right-2 top-2 bg-black px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
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
            className={`absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full shadow ${
              added ? "bg-green-600 text-white" : "bg-[#1a1a1a] text-white"
            }`}
          >
            {added ? <CheckIcon /> : <PlusIcon />}
          </button>
        )}
      </div>
      <div className="min-h-[112px] px-3 pb-3 pt-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-5">{product.name}</h3>
        {variantLabel && <span className="block text-[9px] text-[var(--toss-muted)]">{variantLabel}</span>}
        <p className="flex items-baseline gap-1.5">
          <span className="toss-price-font">৳ {product.price.toFixed(2)} BDT · VAT</span>
          {discountPercent > 0 && (
            <span className="toss-price-font text-xs text-gray-400 line-through">৳{product.marketPrice!.toFixed(2)}</span>
          )}
        </p>
        {isWholesale && (
          <span className="block text-[9px] font-semibold text-[var(--toss-red)]">
            Buy {product.wholesaleMinQty}+ for ৳{product.wholesaleUnitPrice!.toFixed(2)} each
          </span>
        )}
      </div>
    </Link>
  );
}
