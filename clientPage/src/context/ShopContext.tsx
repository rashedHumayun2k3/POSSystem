"use client";

import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { getShopContext } from "@/lib/clientPageApi";
import { useResolvedShopSlug } from "@/lib/useShopSlug";
import type { ShopContextDto } from "@/lib/types";

interface ShopContextValue extends ShopContextDto {
  shopSlug: string | null;
  isLoading: boolean;
}

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopContextProvider({ children }: { children: React.ReactNode }) {
  const shopSlug = useResolvedShopSlug();

  const { data, isLoading } = useQuery({
    queryKey: ["clientpage-shop-context", shopSlug],
    queryFn: () => getShopContext(shopSlug),
    staleTime: 5 * 60_000,
  });

  const value: ShopContextValue = {
    mode: data?.mode ?? "marketplace",
    businessId: data?.businessId,
    shopName: data?.shopName,
    logoUrl: data?.logoUrl,
    bannerUrl: data?.bannerUrl,
    shopSlug,
    isLoading,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShopContext() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShopContext must be used within ShopContextProvider");
  return ctx;
}
