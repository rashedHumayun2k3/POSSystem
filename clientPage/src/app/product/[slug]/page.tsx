"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProductDetail } from "@/lib/clientPageApi";
import { useShopContext } from "@/context/ShopContext";
import { formatVariantLabel } from "@/lib/variantLabel";
import { extractProductId } from "@/lib/slug";
import { useCartStore } from "@/store/cartStore";
import Footer from "@/components/Footer";

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const id = extractProductId(slug);
  const router = useRouter();
  const { shopSlug, mode, isLoading: shopLoading } = useShopContext();

  const { data: product, isLoading } = useQuery({
    queryKey: ["clientpage-product", shopSlug, id],
    queryFn: () => getProductDetail(shopSlug, id!),
    enabled: !shopLoading && !!id,
  });

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  if (!id || (!shopLoading && !isLoading && !product)) {
    return (
      <main className="p-6 text-center">
        <p className="text-sm text-gray-500">Product not found.</p>
        <Link href="/" className="text-sm text-indigo-600">
          ← Back to shop
        </Link>
      </main>
    );
  }

  if (shopLoading || isLoading) {
    return <div className="p-6 text-center text-sm text-gray-400">Loading…</div>;
  }

  const selectedVariant = product!.variants.find((v) => v.id === selectedVariantId) ?? product!.variants[0];

  return (
    <main>
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-white/95 backdrop-blur px-4 py-3 border-b border-gray-100">
        <button onClick={() => router.back()} aria-label="Back" className="text-gray-700">
          <BackIcon />
        </button>
        <span className="text-sm font-medium text-gray-900 truncate">{product!.name}</span>
      </div>

      {/* Below lg: image stacked above details (mobile). At lg+: side by side, image left,
          details right — the same two pieces, just reshaped by breakpoint. */}
      <div className="lg:flex lg:gap-10 lg:p-8">
        <div className="relative aspect-square bg-gray-100 lg:w-1/2 lg:rounded-xl lg:shrink-0">
          {product!.imageUrl ? (
            <Image src={product!.imageUrl} alt={product!.name} fill className="object-contain lg:rounded-xl" unoptimized />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-sm">No image</div>
          )}
        </div>

        <div className="p-4 lg:p-0 flex flex-col gap-2 lg:flex-1 lg:pt-2">
          <h1 className="text-lg lg:text-2xl font-semibold text-gray-900">{product!.name}</h1>
          {mode === "marketplace" && <p className="text-sm text-gray-500">Sold by {product!.shopName}</p>}
          <p className="text-sm text-gray-500">{product!.categoryName}</p>

          <p className="text-xl lg:text-3xl font-bold text-indigo-600">৳{(selectedVariant?.price ?? product!.sellingPrice).toFixed(2)}</p>

          {selectedVariant && !selectedVariant.inStock && (
            <span className="inline-block w-fit bg-gray-900/80 text-white text-xs px-2 py-0.5 rounded">Out of stock</span>
          )}

          {product!.variants.length > 1 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {product!.variants.map((v) => {
                const label = formatVariantLabel(v.variantValuesJson) || "Default";
                const isSelected = (selectedVariant?.id ?? product!.variants[0].id) === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600"
                    } ${!v.inStock ? "opacity-40" : ""}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {product!.description && <p className="text-sm text-gray-600 pt-2">{product!.description}</p>}

          {selectedVariant?.inStock && (
            <div className="flex items-center gap-3 pt-3">
              <div className="flex items-center border border-gray-200 rounded-full">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 flex items-center justify-center text-gray-600"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="w-9 h-9 flex items-center justify-center text-gray-600"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <button
            disabled={!selectedVariant?.inStock}
            onClick={() => {
              if (!selectedVariant) return;
              addItem(
                {
                  variantId: selectedVariant.id,
                  productId: product!.id,
                  name: product!.name,
                  imageUrl: product!.imageUrl,
                  price: selectedVariant.price,
                  variantValuesJson: selectedVariant.variantValuesJson,
                  shopId: product!.shopId,
                  shopName: product!.shopName,
                },
                qty
              );
              setAdded(true);
              setTimeout(() => setAdded(false), 1500);
            }}
            className={`mt-4 lg:mt-6 w-full lg:w-auto lg:px-10 rounded-lg font-medium py-3 ${
              !selectedVariant?.inStock
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : added
                ? "bg-green-600 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {!selectedVariant?.inStock ? "Out of Stock" : added ? "Added ✓" : "Add to Cart"}
          </button>
        </div>
      </div>
      <Footer />
    </main>
  );
}
