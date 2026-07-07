"use client";

import Image from "next/image";
import { useState } from "react";
import { useShopContext } from "@/context/ShopContext";

export default function PromoBanner() {
  const { mode, shopName, bannerUrl } = useShopContext();
  const [bannerFailed, setBannerFailed] = useState(false);

  if (mode === "shop" && bannerUrl && !bannerFailed) {
    return (
      <div className="relative w-full aspect-[16/7] bg-gray-100">
        <Image
          src={bannerUrl}
          alt={shopName ?? "Shop banner"}
          fill
          className="object-cover"
          unoptimized
          priority
          onError={() => setBannerFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[16/7] bg-gradient-to-br from-indigo-600 via-indigo-500 to-fuchsia-500 flex flex-col items-center justify-center text-white text-center px-6">
      <p className="text-lg font-bold">
        {mode === "shop" ? `Welcome to ${shopName ?? "our shop"}` : "Shop from all your favorite sellers"}
      </p>
      <p className="text-sm text-white/80 mt-1">
        {mode === "shop" ? "Quality products, delivered fast" : "One marketplace, hundreds of shops"}
      </p>
    </div>
  );
}
