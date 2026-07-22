import type { SalesChannel } from "@/types/auth";

export type ShopType = "BIG_SUPERSHOP" | "SMALL_SHOWROOM" | "HAWKER_SHOP";

// Online is bundled into every option (no separate toggle) — dashboard/page.tsx and
// BottomTabBar.tsx already gate the lightweight (no-barcode) experience purely on
// salesChannels.includes("HAWKER"), so SMALL_SHOWROOM and HAWKER_SHOP intentionally both map to
// it, correctly activating that experience with no other code changes needed.
export const SHOP_TYPES: { value: ShopType; icon: string; channels: SalesChannel[] }[] = [
  { value: "BIG_SUPERSHOP", icon: "🏢", channels: ["POS", "ONLINE"] },
  { value: "SMALL_SHOWROOM", icon: "🏪", channels: ["HAWKER", "ONLINE"] },
  { value: "HAWKER_SHOP", icon: "🧺", channels: ["HAWKER", "ONLINE"] },
];

// Reverse-map stored channels back to a default selection when reopening the settings screen.
// SMALL_SHOWROOM and HAWKER_SHOP both save as the same ["HAWKER","ONLINE"], so there's no stored
// signal for which of the two was originally picked — default to HAWKER_SHOP (the more general
// label) in that case.
export function shopTypeFromChannels(channels: SalesChannel[] | undefined): ShopType | null {
  if (!channels || channels.length === 0) return null;
  if (channels.includes("POS")) return "BIG_SUPERSHOP";
  if (channels.includes("HAWKER")) return "HAWKER_SHOP";
  return null;
}
