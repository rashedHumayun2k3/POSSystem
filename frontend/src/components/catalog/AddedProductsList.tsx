"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { listAddedProducts } from "@/lib/catalogTemplatesApi";
import { resolveMediaUrl } from "@/lib/media";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AddedProductsList({ search = "" }: { search?: string }) {
  const { t } = useLanguage();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["catalog-templates-added-products"],
    queryFn: listAddedProducts,
  });
  const normalizedSearch = search.trim().toLowerCase();
  const visibleProducts = normalizedSearch
    ? products.filter((product) => product.name.toLowerCase().includes(normalizedSearch))
    : products;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (products.length === 0) {
    return <p className="text-sm text-gray-400 py-2">{t("catalogTemplates.noAddedProductsYet")}</p>;
  }

  if (visibleProducts.length === 0) {
    return <p className="text-sm text-gray-400 py-2">{t("catalogTemplates.noProductSearchResults")}</p>;
  }

  return (
    <div className="space-y-2">
      {visibleProducts.map((product) => {
        const isOutOfStock = product.totalStock <= 0;
        const isLowStock = !isOutOfStock && product.totalStock < product.lowStockThreshold;
        return (
          <Link key={product.id} href={`/products/${product.id}`}>
            <div className="bg-white border border-gray-100 rounded-xl p-3 flex gap-3 active:bg-gray-50">
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={resolveMediaUrl(product.imageUrl) ?? ""}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{product.sku} · {product.categoryName}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-semibold text-gray-900">৳{product.sellingPrice.toLocaleString()}</span>
                  <span className={`text-xs ${isOutOfStock ? "text-red-600 font-semibold" : isLowStock ? "text-amber-600 font-semibold" : "text-gray-400"}`}>
                    {product.totalStock} {product.unitCode}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
