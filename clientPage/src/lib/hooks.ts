import { useQuery } from "@tanstack/react-query";
import { getCategories, getPopularShops } from "./clientPageApi";
import { useShopContext } from "@/context/ShopContext";

export function useCategories() {
  const { shopSlug, isLoading: shopLoading } = useShopContext();

  const query = useQuery({
    queryKey: ["clientpage-categories", shopSlug],
    queryFn: () => getCategories(shopSlug),
    enabled: !shopLoading,
  });

  return { ...query, isLoading: shopLoading || query.isLoading };
}

export function usePopularShops() {
  return useQuery({
    queryKey: ["clientpage-shops"],
    queryFn: () => getPopularShops(),
  });
}

export const CATEGORY_COLORS = [
  "bg-rose-100 text-rose-600",
  "bg-amber-100 text-amber-600",
  "bg-emerald-100 text-emerald-600",
  "bg-sky-100 text-sky-600",
  "bg-violet-100 text-violet-600",
  "bg-pink-100 text-pink-600",
  "bg-teal-100 text-teal-600",
  "bg-orange-100 text-orange-600",
];
