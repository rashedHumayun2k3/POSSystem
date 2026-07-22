"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePopularShops } from "@/lib/hooks";
import { useShopContext } from "@/context/ShopContext";
import { resolveMediaUrl } from "@/lib/media";

const PAGE_SIZE = 20;

function ShopLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMediaUrl(logoUrl);

  if (resolved && !failed) {
    return (
      <Image
        src={resolved}
        alt={name}
        width={56}
        height={56}
        className="rounded-full object-cover bg-gray-100"
        unoptimized
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold">
      {name[0]?.toUpperCase()}
    </div>
  );
}

export default function PopularShops() {
  const { mode } = useShopContext();
  const { data, isLoading } = usePopularShops();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Only meaningful in marketplace mode — in shop mode the visitor is already on the one shop.
  if (mode !== "marketplace" || isLoading || !data || data.length < 2) return null;

  const visible = data.slice(0, visibleCount);
  const hasMore = visibleCount < data.length;

  return (
    <div className="bg-white border-t border-gray-100">
      <h2 className="px-4 lg:px-8 pt-4 text-sm lg:text-base font-semibold text-gray-900">Popular Shops</h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-x-2 gap-y-4 px-4 lg:px-8 py-3">
        {visible.map((shop) => (
          <Link
            key={shop.id}
            href={shop.subdomain ? `/shop/${shop.subdomain}` : "#"}
            className="flex flex-col items-center gap-1.5"
          >
            <ShopLogo name={shop.name} logoUrl={shop.logoUrl} />
            <span className="text-[11px] text-gray-700 text-center leading-tight line-clamp-2">{shop.name}</span>
          </Link>
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center pb-4">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-sm font-medium text-indigo-600 px-4 py-1.5 rounded-full border border-indigo-200 hover:bg-indigo-50"
          >
            Show More
          </button>
        </div>
      )}
    </div>
  );
}
