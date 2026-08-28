"use client";

import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getShopContext } from "@/lib/clientPageApi";
import { useResolvedShopSlug } from "@/lib/useShopSlug";
import { isExportedStorefrontMode } from "@/lib/storefrontConfig";
import type { ShopContextDto } from "@/lib/types";

interface ShopContextValue extends ShopContextDto {
  shopSlug: string | null;
  isLoading: boolean;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopContextProvider({ children }: { children: React.ReactNode }) {
  const shopSlug = useResolvedShopSlug();
  const exportedConfigLoading = isExportedStorefrontMode() && shopSlug === null;

  const { data, isLoading } = useQuery({
    queryKey: ["clientpage-shop-context", shopSlug],
    queryFn: () => getShopContext(shopSlug),
    enabled: !exportedConfigLoading,
    staleTime: 5 * 60_000,
  });

  const value: ShopContextValue = {
    mode: data?.mode ?? (isExportedStorefrontMode() ? "shop" : "marketplace"),
    businessId: data?.businessId,
    shopName: data?.shopName,
    logoUrl: data?.logoUrl,
    bannerUrl: data?.bannerUrl,
    websiteUrl: data?.websiteUrl,
    websiteSettings: data?.websiteSettings,
    shopSlug,
    isLoading: exportedConfigLoading || isLoading,
  };

  useEffect(() => {
    if (value.mode !== "shop" || typeof document === "undefined") return;

    document.title = value.shopName ?? "Shop";
    const faviconUrl = value.websiteSettings?.faviconUrl ?? value.logoUrl;
    if (!faviconUrl) return;

    const existing = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    const link = existing ?? document.createElement("link");
    link.rel = "icon";
    link.href = faviconUrl;
    if (!existing) document.head.appendChild(link);
  }, [value.logoUrl, value.mode, value.shopName, value.websiteSettings?.faviconUrl]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShopContext() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShopContext must be used within ShopContextProvider");
  return ctx;
}
