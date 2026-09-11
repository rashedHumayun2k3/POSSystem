import type { SalesChannel, ShopType } from "@/types/auth";

export type { ShopType } from "@/types/auth";

// Online is bundled into every option (no separate toggle) — dashboard/page.tsx and
// BottomTabBar.tsx already gate the lightweight (no-barcode) experience purely on
// salesChannels.includes("HAWKER"), so SMALL_SHOWROOM and HAWKER_SHOP intentionally both map to
// it, correctly activating that experience with no other code changes needed.
export const SHOP_TYPES: { value: ShopType; icon: string; channels: SalesChannel[] }[] = [
  { value: "BIG_SUPERSHOP", icon: "🏢", channels: ["POS", "ONLINE"] },
  { value: "SMALL_SHOWROOM", icon: "🏪", channels: ["HAWKER", "ONLINE"] },
  { value: "HAWKER_SHOP", icon: "🧺", channels: ["HAWKER", "ONLINE"] },
];

// Support businesses saved before the exact ShopType field was introduced. Those legacy records
// only contain channels, so the shared Hawker/Small Showroom channel set falls back to Hawker Shop.
export function shopTypeFromChannels(channels: SalesChannel[] | undefined): ShopType | null {
  if (!channels || channels.length === 0) return null;
  if (channels.includes("POS")) return "BIG_SUPERSHOP";
  if (channels.includes("HAWKER")) return "HAWKER_SHOP";
  return null;
}
